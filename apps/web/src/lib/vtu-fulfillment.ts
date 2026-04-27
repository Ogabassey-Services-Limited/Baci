import type { SupabaseClient } from '@supabase/supabase-js';
import { type PurchaseResult, purchaseAirtime, purchaseData } from '@/lib/kuda';
import { purchaseBill } from '@/lib/kuda-bills';
import { normalizeVtuNetworkProvider } from '@/lib/normalize-vtu-network-provider';
import { VTU_TYPE_LABELS } from '@/lib/vtu-pending-transaction';

interface VtuTransactionRow {
  amount: number;
  biller_item_code: string | null;
  biller_name: string | null;
  customer_cashback: number | null;
  customer_id: string | null;
  customer_identifier: string | null;
  error_message: string | null;
  id: string;
  merchant_commission: number | null;
  merchant_id: string;
  metadata: Record<string, unknown> | null;
  network_provider: string;
  phone_number: string;
  request_reference: string;
  status: 'pending' | 'processing' | 'successful' | 'failed';
  transaction_id: string | null;
  type: 'airtime' | 'data' | 'electricity' | 'cable_tv' | 'betting';
}

export type FulfilledVtuResult =
  | {
      amount: number;
      cashback?: { amount: number; credited: boolean; newBalance: number };
      customerIdentifier?: string;
      reference: string;
      status: 'successful';
    }
  | { amount: number; error: string; reference: string; status: 'failed' }
  | { amount: number; reference: string; status: 'processing' };

function getCustomerFirstName(row: VtuTransactionRow, merchantName: string) {
  if (
    typeof row.metadata?.customerName === 'string' &&
    row.metadata.customerName
  ) {
    return row.metadata.customerName;
  }

  return merchantName || 'Customer';
}

type NormalizedProvider = NonNullable<
  ReturnType<typeof normalizeVtuNetworkProvider>
>;

type ProviderNormalizationResult =
  | { provider: NormalizedProvider }
  | { failure: PurchaseResult };

function normalizeVtuProviderOrError(
  row: VtuTransactionRow
): ProviderNormalizationResult {
  const provider = normalizeVtuNetworkProvider(row.network_provider);
  if (!provider) {
    return {
      failure: {
        amount: row.amount,
        message: `Invalid network provider: ${row.network_provider}`,
        phoneNumber: row.phone_number,
        provider: row.network_provider,
        reference: row.request_reference,
        status: 'failed',
        success: false,
      },
    };
  }
  return { provider };
}

function executeVtuPurchase(
  row: VtuTransactionRow,
  merchantName: string
): Promise<PurchaseResult> {
  const customerFirstName = getCustomerFirstName(row, merchantName);

  if (row.type === 'airtime') {
    const normalized = normalizeVtuProviderOrError(row);
    if ('failure' in normalized) {
      return Promise.resolve(normalized.failure);
    }

    return purchaseAirtime(
      row.phone_number,
      row.amount,
      normalized.provider,
      customerFirstName,
      row.request_reference
    );
  }

  if (row.type === 'data') {
    const normalized = normalizeVtuProviderOrError(row);
    if ('failure' in normalized) {
      return Promise.resolve(normalized.failure);
    }

    const dataPlanCode =
      typeof row.metadata?.dataPlanCode === 'string'
        ? row.metadata.dataPlanCode
        : '';
    if (!dataPlanCode) {
      return Promise.resolve({
        amount: row.amount,
        message: 'Data plan code is required for data purchases',
        reference: row.request_reference,
        status: 'failed',
        success: false,
      });
    }

    return purchaseData(
      row.phone_number,
      dataPlanCode,
      row.amount,
      normalized.provider,
      customerFirstName,
      row.request_reference
    );
  }

  if (!row.biller_item_code || !row.customer_identifier) {
    return Promise.resolve({
      amount: row.amount,
      message: 'Missing bill item or customer identifier',
      reference: row.request_reference,
      status: 'failed',
      success: false,
    });
  }

  return purchaseBill(
    row.biller_item_code,
    row.customer_identifier,
    row.amount,
    customerFirstName,
    row.request_reference
  );
}

export async function fulfillPendingVtuTransaction({
  supabase,
  transactionId,
}: {
  supabase: SupabaseClient;
  transactionId: string;
}): Promise<FulfilledVtuResult> {
  const { data: existing, error: existingError } = await supabase
    .from('vtu_transactions')
    .select(
      'id, merchant_id, customer_id, type, network_provider, phone_number, amount, request_reference, transaction_id, status, metadata, error_message, merchant_commission, customer_cashback, biller_name, biller_item_code, customer_identifier'
    )
    .eq('id', transactionId)
    .single();

  if (existingError || !existing) {
    throw new Error('VTU transaction not found');
  }

  const row = existing as VtuTransactionRow;
  if (row.status === 'successful') {
    const cashbackAmount = Number(row.customer_cashback ?? 0);
    const newBalance =
      typeof row.metadata?.customerNewBalance === 'number'
        ? row.metadata.customerNewBalance
        : 0;
    return {
      amount: Number(row.amount) || 0,
      cashback:
        cashbackAmount > 0
          ? {
              amount: cashbackAmount,
              credited: Boolean(row.metadata?.customerWalletCredited),
              newBalance,
            }
          : undefined,
      customerIdentifier: row.customer_identifier ?? undefined,
      reference: row.request_reference,
      status: 'successful',
    };
  }

  if (row.status === 'failed') {
    return {
      amount: Number(row.amount) || 0,
      error: row.error_message || 'Purchase failed',
      reference: row.request_reference,
      status: 'failed',
    };
  }

  if (row.status === 'processing') {
    return {
      amount: Number(row.amount) || 0,
      reference: row.request_reference,
      status: 'processing',
    };
  }

  const { data: claimed } = await supabase
    .from('vtu_transactions')
    .update({ status: 'processing' })
    .eq('id', transactionId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();

  if (!claimed) {
    return {
      amount: Number(row.amount) || 0,
      reference: row.request_reference,
      status: 'processing',
    };
  }

  const { data: merchant } = await supabase
    .from('merchants')
    .select('business_name')
    .eq('id', row.merchant_id)
    .single();

  const result = await executeVtuPurchase(
    row,
    merchant?.business_name || 'Customer'
  );

  await supabase
    .from('vtu_transactions')
    .update({
      error_message: result.success ? null : result.message,
      status: result.success ? 'successful' : 'failed',
      transaction_id: result.transactionId ?? null,
    })
    .eq('id', row.id);

  if (!result.success) {
    return {
      amount: Number(row.amount) || 0,
      error: result.message,
      reference: row.request_reference,
      status: 'failed',
    };
  }

  const merchantCommission = Number(row.merchant_commission ?? 0);
  const cashbackAmount = Number(row.customer_cashback ?? 0);
  let merchantWalletCredited = false;
  let customerWalletCredited = false;
  let customerNewBalance = 0;

  if (merchantCommission > 0) {
    const { error } = await supabase.rpc('credit_merchant_wallet', {
      p_merchant_id: row.merchant_id,
      p_amount: merchantCommission,
      p_source_type: 'vtu_transaction',
      p_source_id: row.id,
      p_description: `VTU Commission - ${VTU_TYPE_LABELS[row.type]} ${row.network_provider || row.biller_name || ''} ₦${row.amount}`,
    });
    merchantWalletCredited = !error;
  }

  if (cashbackAmount > 0 && row.customer_id) {
    const { data, error } = await supabase.rpc('credit_customer_wallet', {
      p_customer_id: row.customer_id,
      p_merchant_id: row.merchant_id,
      p_amount: cashbackAmount,
      p_source_type: 'vtu_transaction',
      p_source_id: row.id,
      p_description: `Cashback - ${VTU_TYPE_LABELS[row.type]} ${row.network_provider || row.biller_name || ''} ₦${row.amount}`,
    });

    if (!error) {
      customerWalletCredited = true;
      const nextBalance = Array.isArray(data) ? data[0]?.new_balance : null;
      customerNewBalance = typeof nextBalance === 'number' ? nextBalance : 0;
    }
  }

  await supabase
    .from('vtu_transactions')
    .update({
      metadata: {
        ...(row.metadata ?? {}),
        customerNewBalance,
        customerWalletCredited,
        merchantWalletCredited,
        paymentPending: false,
      },
    })
    .eq('id', row.id);

  return {
    amount: Number(row.amount) || 0,
    cashback:
      cashbackAmount > 0
        ? {
            amount: cashbackAmount,
            credited: customerWalletCredited,
            newBalance: customerNewBalance,
          }
        : undefined,
    customerIdentifier: row.customer_identifier ?? undefined,
    reference: row.request_reference,
    status: 'successful',
  };
}
