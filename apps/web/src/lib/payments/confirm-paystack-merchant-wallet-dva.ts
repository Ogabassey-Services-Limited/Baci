import type { SupabaseClient } from '@supabase/supabase-js';
import { hasActivePaystackOrderDvaAlias } from '@/lib/payments/paystack-dva-order-alias';

export type MerchantWalletDvaResult =
  | { kind: 'none' }
  | { kind: 'match'; balance: number; firstCredit: boolean }
  | { kind: 'review'; status: 409; body: { code: string; error: string } };

export async function confirmPaystackMerchantWalletDva({
  supabase,
  accountNumber,
  gatewayReference,
  verifiedAmount,
  paystackResponse,
}: {
  supabase: SupabaseClient;
  accountNumber: string | null;
  gatewayReference: string;
  verifiedAmount: { amount: number; currency?: string } | null;
  paystackResponse: Record<string, unknown>;
}): Promise<MerchantWalletDvaResult> {
  if (
    !accountNumber ||
    !verifiedAmount ||
    verifiedAmount.amount <= 0 ||
    verifiedAmount.currency !== 'NGN'
  )
    return { kind: 'none' };
  const { data: accounts, error } = await supabase
    .from('merchant_wallet_payment_accounts')
    .select('merchant_id, account_number, status')
    .eq('account_number', accountNumber)
    .eq('status', 'active');
  if (error) throw error;
  if (accounts?.length !== 1)
    return accounts && accounts.length > 1
      ? {
          kind: 'review',
          status: 409,
          body: {
            code: 'MERCHANT_WALLET_DVA_AMBIGUOUS',
            error: 'Multiple merchant wallet accounts matched',
          },
        }
      : { kind: 'none' };
  const paidAt =
    typeof paystackResponse.paid_at === 'string'
      ? new Date(paystackResponse.paid_at)
      : new Date();
  if (
    await hasActivePaystackOrderDvaAlias({
      accountNumber,
      asOf: paidAt,
      supabase,
    })
  )
    return {
      kind: 'review',
      status: 409,
      body: {
        code: 'WALLET_DVA_ORDER_ALIAS_CONFLICT',
        error: 'Receiver account is reserved for an active order',
      },
    };
  const { data, error: creditError } = await supabase.rpc(
    'credit_merchant_wallet_funding',
    {
      p_merchant_id: accounts[0].merchant_id,
      p_amount: verifiedAmount.amount,
      p_currency: 'NGN',
      p_reference: gatewayReference,
      p_account_number: accountNumber,
    }
  );
  if (creditError || !data?.[0])
    throw creditError ?? new Error('Merchant wallet funding credit failed');
  return {
    kind: 'match',
    balance: Number(data[0].new_balance),
    firstCredit: data[0].first_credit === true,
  };
}
