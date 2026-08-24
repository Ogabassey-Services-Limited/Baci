import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

interface DvaOrderBalance {
  amount_paid: number | string | null;
  total: number | string;
  wallet_amount_used: number | string | null;
}

type DvaProvisioningContext =
  | { ok: true; payableAmount: number }
  | { code: string; error: string; ok: false; status: number };

export async function loadDvaProvisioningContext({
  merchantId,
  order,
  orderId,
  supabase,
}: {
  merchantId: string;
  order: DvaOrderBalance;
  orderId: string;
  supabase: SupabaseClient<Database>;
}): Promise<DvaProvisioningContext> {
  const { data: settings, error: settingsError } = await supabase
    .from('merchant_feature_settings')
    .select('paystack_enabled')
    .eq('merchant_id', merchantId)
    .maybeSingle();

  if (settingsError) {
    return {
      code: 'FEATURE_SETTINGS_LOOKUP_FAILED',
      error: 'Unable to verify Paystack availability',
      ok: false,
      status: 500,
    };
  }
  if (settings?.paystack_enabled === false) {
    return {
      code: 'GATEWAY_DISABLED',
      error: 'Paystack is not enabled for this merchant',
      ok: false,
      status: 400,
    };
  }

  const { data: transactions, error: transactionsError } = await supabase
    .from('transactions')
    .select('amount, gateway')
    .eq('order_id', orderId)
    .eq('merchant_id', merchantId)
    .eq('transaction_type', 'payment')
    .in('status', ['success', 'completed']);

  if (transactionsError) {
    return {
      code: 'PAYMENT_BALANCE_LOOKUP_FAILED',
      error: 'Unable to verify the remaining order balance',
      ok: false,
      status: 500,
    };
  }

  const totals = (transactions ?? []).reduce(
    (result, transaction) => {
      const amount = Number(transaction.amount) || 0;
      const gateway = transaction.gateway?.trim().toLowerCase();
      result.transactionTotal += amount;
      if (gateway === 'wallet' || gateway === 'store_credit') {
        result.walletTransactionTotal += amount;
      }
      return result;
    },
    { transactionTotal: 0, walletTransactionTotal: 0 }
  );
  const walletAmountUsed = Number(order.wallet_amount_used) || 0;
  const ledgerAmountPaid =
    totals.transactionTotal +
    Math.max(0, walletAmountUsed - totals.walletTransactionTotal);
  const amountPaid = Math.max(ledgerAmountPaid, Number(order.amount_paid) || 0);
  const payableAmount = Math.max(Number(order.total) - amountPaid, 0);

  const { error: refreshError } = await supabase
    .from('order_payment_accounts')
    .update({ payable_amount: payableAmount })
    .eq('order_id', orderId)
    .eq('provider', 'paystack');
  if (refreshError) {
    return {
      code: 'PAYMENT_ACCOUNT_REFRESH_FAILED',
      error: 'Unable to refresh the automatic confirmation balance',
      ok: false,
      status: 500,
    };
  }

  return payableAmount > 0
    ? { ok: true, payableAmount }
    : {
        code: 'NO_PAYABLE_AMOUNT',
        error: 'No payable amount remains for this order',
        ok: false,
        status: 400,
      };
}
