import type { SupabaseClient } from '@supabase/supabase-js';
import { notifyCustomer } from '@/lib/expo-push';
import {
  checkTransactionStatus,
  type PurchaseResult,
  purchaseAirtime,
  purchaseData,
} from '@/lib/kuda';
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
      voucherPin?: string;
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

function getVoucherPinFromMetadata(metadata: Record<string, unknown> | null) {
  return normalizeVoucherPin(metadata?.voucherPin);
}

function normalizeVoucherPin(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

function canResolveBillVoucherPin(type: VtuTransactionRow['type']) {
  return type === 'electricity' || type === 'cable_tv' || type === 'betting';
}

function coerceNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatNaira(amount: number) {
  return `₦${new Intl.NumberFormat('en-NG', {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount)}`;
}

function getVtuProviderLabel(row: VtuTransactionRow) {
  return row.network_provider || row.biller_name || VTU_TYPE_LABELS[row.type];
}

function setMetadataValue(
  metadata: Record<string, unknown>,
  key: string,
  value: unknown
) {
  if (metadata[key] === value) {
    return false;
  }
  metadata[key] = value;
  return true;
}

async function findExistingCustomerCashback({
  row,
  supabase,
}: {
  row: VtuTransactionRow;
  supabase: SupabaseClient;
}) {
  if (!row.customer_id) {
    return null;
  }

  const { data, error } = await supabase
    .from('customer_wallet_transactions')
    .select('balance_after')
    .eq('customer_id', row.customer_id)
    .eq('merchant_id', row.merchant_id)
    .eq('source_type', 'vtu_transaction')
    .eq('source_id', row.id)
    .eq('type', 'cashback')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Failed to check existing VTU cashback ledger:', {
      error: error.message,
      transactionId: row.id,
    });
    return null;
  }

  return data;
}

async function findExistingMerchantCommission({
  row,
  supabase,
}: {
  row: VtuTransactionRow;
  supabase: SupabaseClient;
}) {
  const { data, error } = await supabase
    .from('wallet_transactions')
    .select('id')
    .eq('merchant_id', row.merchant_id)
    .eq('source_type', 'vtu_transaction')
    .eq('source_id', row.id)
    .eq('type', 'credit')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Failed to check existing VTU merchant commission:', {
      error: error.message,
      transactionId: row.id,
    });
    return null;
  }

  return data;
}

async function settleVtuWalletCredits({
  metadata,
  row,
  supabase,
}: {
  metadata: Record<string, unknown>;
  row: VtuTransactionRow;
  supabase: SupabaseClient;
}) {
  const merchantCommission = Number(row.merchant_commission ?? 0);
  const cashbackAmount = Number(row.customer_cashback ?? 0);
  let metadataChanged = false;
  let merchantWalletCredited = metadata.merchantWalletCredited === true;
  let customerWalletCredited = metadata.customerWalletCredited === true;
  let customerNewBalance = coerceNumber(metadata.customerNewBalance);

  if (merchantCommission > 0 && !merchantWalletCredited) {
    const existingCommission = await findExistingMerchantCommission({
      row,
      supabase,
    });

    if (existingCommission) {
      merchantWalletCredited = true;
    } else {
      const { error } = await supabase.rpc('credit_merchant_wallet', {
        p_merchant_id: row.merchant_id,
        p_amount: merchantCommission,
        p_source_type: 'vtu_transaction',
        p_source_id: row.id,
        p_description: `VTU Commission - ${VTU_TYPE_LABELS[row.type]} ${getVtuProviderLabel(row)} ₦${row.amount}`,
      });
      merchantWalletCredited = !error;
    }

    metadataChanged =
      setMetadataValue(
        metadata,
        'merchantWalletCredited',
        merchantWalletCredited
      ) || metadataChanged;
  }

  if (cashbackAmount > 0 && row.customer_id && !customerWalletCredited) {
    const existingCashback = await findExistingCustomerCashback({
      row,
      supabase,
    });

    if (existingCashback) {
      customerWalletCredited = true;
      customerNewBalance = coerceNumber(existingCashback.balance_after);
    } else {
      const { data, error } = await supabase.rpc('credit_customer_wallet', {
        p_customer_id: row.customer_id,
        p_merchant_id: row.merchant_id,
        p_amount: cashbackAmount,
        p_source_type: 'vtu_transaction',
        p_source_id: row.id,
        p_description: `Cashback - ${VTU_TYPE_LABELS[row.type]} ${getVtuProviderLabel(row)} ₦${row.amount}`,
      });

      if (!error) {
        customerWalletCredited = true;
        const nextBalance = Array.isArray(data) ? data[0]?.new_balance : null;
        customerNewBalance = coerceNumber(nextBalance);
      }
    }

    metadataChanged =
      setMetadataValue(
        metadata,
        'customerWalletCredited',
        customerWalletCredited
      ) || metadataChanged;
    metadataChanged =
      setMetadataValue(metadata, 'customerNewBalance', customerNewBalance) ||
      metadataChanged;
  }

  return {
    customerNewBalance,
    customerWalletCredited,
    merchantWalletCredited,
    metadataChanged,
  };
}

async function notifyVtuCustomerSuccess({
  cashbackAmount,
  customerWalletCredited,
  metadata,
  row,
  supabase,
}: {
  cashbackAmount: number;
  customerWalletCredited: boolean;
  metadata: Record<string, unknown>;
  row: VtuTransactionRow;
  supabase: SupabaseClient;
}) {
  if (!row.customer_id || metadata.customerNotificationAttempted === true) {
    return { metadataChanged: false };
  }

  const { data: customer, error } = await supabase
    .from('customers')
    .select('user_id')
    .eq('id', row.customer_id)
    .maybeSingle();

  if (error || !customer?.user_id) {
    if (error) {
      console.error('Failed to resolve VTU customer notification user:', {
        error: error.message,
        transactionId: row.id,
      });
    }
    return { metadataChanged: false };
  }

  const label = VTU_TYPE_LABELS[row.type];
  const provider = getVtuProviderLabel(row);
  const baseBody = `Your ${provider} ${label.toLowerCase()} purchase of ${formatNaira(Number(row.amount) || 0)} was successful.`;
  const cashbackBody =
    cashbackAmount > 0 && customerWalletCredited
      ? ` ${formatNaira(cashbackAmount)} cashback was credited to your wallet.`
      : '';

  try {
    const result = await notifyCustomer(
      customer.user_id,
      `${label} purchase successful`,
      `${baseBody}${cashbackBody}`,
      {
        amount: Number(row.amount) || 0,
        cashbackAmount,
        reference: row.request_reference,
        transactionId: row.id,
        type: 'vtu_purchase_success',
        vtuType: row.type,
      },
      'orders'
    );

    let metadataChanged = setMetadataValue(
      metadata,
      'customerNotificationAttempted',
      true
    );
    metadataChanged =
      setMetadataValue(metadata, 'customerNotificationSent', result.sent > 0) ||
      metadataChanged;
    return { metadataChanged };
  } catch (error) {
    console.error('Failed to send VTU success notification:', {
      error: error instanceof Error ? error.message : String(error),
      transactionId: row.id,
    });
    return { metadataChanged: false };
  }
}

export async function backfillVtuVoucherPin({
  billResponseReference,
  billRequestRef,
  metadata,
  supabase,
  transactionId,
}: {
  billRequestRef?: string | null;
  billResponseReference?: string | null;
  metadata: Record<string, unknown> | null;
  supabase: SupabaseClient;
  transactionId: string;
}) {
  const existingVoucherPin = getVoucherPinFromMetadata(metadata);
  if (existingVoucherPin) {
    return existingVoucherPin;
  }

  if (!billResponseReference && !billRequestRef) {
    return undefined;
  }

  try {
    const status = await checkTransactionStatus(
      billResponseReference ?? undefined,
      billRequestRef ?? undefined
    );
    const voucherPin = normalizeVoucherPin(status.pin);
    if (!voucherPin) {
      return undefined;
    }

    const { error } = await supabase
      .from('vtu_transactions')
      .update({ metadata: { ...(metadata ?? {}), voucherPin } })
      .eq('id', transactionId);

    if (error) {
      console.error('Failed to persist VTU voucher pin:', {
        error: error.message,
        transactionId,
      });
    }

    return voucherPin;
  } catch (error) {
    console.error('Failed to backfill VTU voucher pin from Kuda:', error);
    return undefined;
  }
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
  retryFailed = false,
  supabase,
  transactionId,
}: {
  retryFailed?: boolean;
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
    const metadata = { ...(row.metadata ?? {}) };
    let metadataChanged = false;
    const cashbackAmount = Number(row.customer_cashback ?? 0);
    const voucherPin = canResolveBillVoucherPin(row.type)
      ? await backfillVtuVoucherPin({
          billRequestRef: row.request_reference,
          billResponseReference: row.transaction_id,
          metadata: row.metadata,
          supabase,
          transactionId: row.id,
        })
      : getVoucherPinFromMetadata(row.metadata);
    if (voucherPin) {
      metadataChanged =
        setMetadataValue(metadata, 'voucherPin', voucherPin) || metadataChanged;
    }
    const walletSettlement = await settleVtuWalletCredits({
      metadata,
      row,
      supabase,
    });
    metadataChanged = walletSettlement.metadataChanged || metadataChanged;
    const notificationSettlement = await notifyVtuCustomerSuccess({
      cashbackAmount,
      customerWalletCredited: walletSettlement.customerWalletCredited,
      metadata,
      row,
      supabase,
    });
    metadataChanged = notificationSettlement.metadataChanged || metadataChanged;

    if (metadataChanged) {
      await supabase
        .from('vtu_transactions')
        .update({ metadata })
        .eq('id', row.id);
    }

    return {
      amount: Number(row.amount) || 0,
      cashback:
        cashbackAmount > 0
          ? {
              amount: cashbackAmount,
              credited: walletSettlement.customerWalletCredited,
              newBalance: walletSettlement.customerNewBalance,
            }
          : undefined,
      customerIdentifier: row.customer_identifier ?? undefined,
      reference: row.request_reference,
      status: 'successful',
      ...(voucherPin && { voucherPin }),
    };
  }

  if (row.status === 'failed' && !retryFailed) {
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

  const claimableStatus =
    row.status === 'failed' && retryFailed ? 'failed' : 'pending';
  const { data: claimed } = await supabase
    .from('vtu_transactions')
    .update({ error_message: null, status: 'processing' })
    .eq('id', transactionId)
    .eq('status', claimableStatus)
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

  const voucherPin =
    normalizeVoucherPin(result.pin) ||
    (result.success && canResolveBillVoucherPin(row.type)
      ? await backfillVtuVoucherPin({
          billRequestRef: row.request_reference,
          billResponseReference: result.transactionId ?? row.transaction_id,
          metadata: row.metadata,
          supabase,
          transactionId: row.id,
        })
      : undefined);
  const updatedMetadata = {
    ...(row.metadata ?? {}),
    ...(voucherPin && { voucherPin }),
  };

  await supabase
    .from('vtu_transactions')
    .update({
      error_message: result.success ? null : result.message,
      metadata: updatedMetadata,
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

  const cashbackAmount = Number(row.customer_cashback ?? 0);
  const finalMetadata = { ...updatedMetadata };
  const walletSettlement = await settleVtuWalletCredits({
    metadata: finalMetadata,
    row,
    supabase,
  });
  await notifyVtuCustomerSuccess({
    cashbackAmount,
    customerWalletCredited: walletSettlement.customerWalletCredited,
    metadata: finalMetadata,
    row,
    supabase,
  });
  setMetadataValue(finalMetadata, 'paymentPending', false);

  await supabase
    .from('vtu_transactions')
    .update({
      metadata: finalMetadata,
    })
    .eq('id', row.id);

  return {
    amount: Number(row.amount) || 0,
    cashback:
      cashbackAmount > 0
        ? {
            amount: cashbackAmount,
            credited: walletSettlement.customerWalletCredited,
            newBalance: walletSettlement.customerNewBalance,
          }
        : undefined,
    customerIdentifier: row.customer_identifier ?? undefined,
    reference: row.request_reference,
    status: 'successful',
    ...(voucherPin && { voucherPin }),
  };
}
