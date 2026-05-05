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
  source:
    | 'checkout'
    | 'loyalty_reward'
    | 'direct'
    | 'gift'
    | 'storefront_modal'
    | null;
  status: 'pending' | 'processing' | 'successful' | 'failed';
  transaction_id: string | null;
  type: 'airtime' | 'data' | 'electricity' | 'cable_tv' | 'betting';
}

interface CreditWalletResult {
  new_balance: unknown;
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
  | {
      amount: number;
      error: string;
      reference: string;
      refundedToWallet?: number;
      status: 'failed';
    }
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

function getSafeMetadataDiagnostics(metadata: Record<string, unknown>) {
  const safeKeys = [
    'customerNewBalance',
    'customerWalletCredited',
    'dataPlanCode',
    'gateway',
    'merchantWalletCredited',
    'paymentPending',
    'paymentReference',
  ] as const;
  const diagnostics: Record<string, unknown> = {};

  for (const key of safeKeys) {
    if (key in metadata) {
      diagnostics[key] = metadata[key];
    }
  }

  if ('voucherPin' in metadata) {
    diagnostics.voucherPin = '[REDACTED]';
  }
  if ('customerName' in metadata) {
    diagnostics.customerName = '[REDACTED]';
  }

  return diagnostics;
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

function isCreditWalletResult(value: unknown): value is CreditWalletResult {
  return typeof value === 'object' && value !== null && 'new_balance' in value;
}

function getCreditWalletNewBalance(data: unknown) {
  const result = Array.isArray(data)
    ? data.find((item) => isCreditWalletResult(item))
    : data;

  return isCreditWalletResult(result) ? result.new_balance : null;
}

function normalizeProviderStatus(status: string) {
  const normalized = status
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  if (
    normalized === 'completed' ||
    normalized === 'complete' ||
    normalized === 'success' ||
    normalized === 'successful'
  ) {
    return 'successful';
  }

  if (
    normalized === 'inprogress' ||
    normalized === 'pending' ||
    normalized === 'processing'
  ) {
    return 'processing';
  }

  if (
    normalized === 'failed' ||
    normalized === 'failure' ||
    normalized === 'unsuccessful'
  ) {
    return 'failed';
  }

  return 'unknown';
}

function normalizeDbVtuStatus(status: unknown): VtuTransactionRow['status'] {
  if (
    status === 'pending' ||
    status === 'processing' ||
    status === 'successful' ||
    status === 'failed'
  ) {
    return status;
  }

  console.warn(
    'Unexpected VTU transaction DB status; using processing fallback:',
    {
      status,
    }
  );
  return 'processing';
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

/**
 * Refund a failed VTU vend's payment to the customer wallet so the customer
 * can retry from wallet credit instead of waiting on a card refund.
 *
 * Gates:
 *  - row.customer_id must be set (no wallet to credit otherwise)
 *  - row.amount must be positive
 *  - row.source === 'checkout' — only checkout-sourced VTU transactions
 *    actually collect money (via Paystack initialize OR saved-card charge);
 *    'direct' and 'storefront_modal' are blocked at the API layer before
 *    a row is ever created, and 'loyalty_reward' / 'gift' are funded by
 *    points / merchant, not the customer's payment method.
 *
 * Note: an earlier draft gated on metadata.paymentReference but the
 * saved-card charge path stores that on the transactions row only, not
 * on vtu_transactions.metadata, so it would have skipped the refund for
 * saved-card customers (the exact case we most want to cover).
 *
 * Idempotent at the RPC layer via pg_advisory_xact_lock + a uniqueness
 * lookup on (source_type='vtu_transaction_refund', source_id, type='refund').
 * Also writes metadata.refundIssued / metadata.refundAmount for visibility.
 */
async function refundVtuToCustomerWallet({
  metadata,
  row,
  supabase,
}: {
  metadata: Record<string, unknown>;
  row: VtuTransactionRow;
  supabase: SupabaseClient;
}): Promise<{
  metadataChanged: boolean;
  refundIssued: boolean;
  refundedAmount: number;
}> {
  const refundedAmount = Number(row.amount ?? 0);

  if (!row.customer_id || refundedAmount <= 0) {
    return { metadataChanged: false, refundIssued: false, refundedAmount: 0 };
  }
  if (row.source !== 'checkout') {
    return { metadataChanged: false, refundIssued: false, refundedAmount: 0 };
  }
  if (metadata.refundIssued === true) {
    // Already refunded on a prior fulfillment pass.
    return {
      metadataChanged: false,
      refundIssued: true,
      refundedAmount: Number(metadata.refundAmount ?? refundedAmount),
    };
  }

  const { error } = await supabase.rpc('refund_customer_wallet_for_vtu', {
    p_customer_id: row.customer_id,
    p_merchant_id: row.merchant_id,
    p_amount: refundedAmount,
    p_vtu_transaction_id: row.id,
    p_description: `Refund for failed ${VTU_TYPE_LABELS[row.type]} ${getVtuProviderLabel(row)} purchase ₦${row.amount}`,
  });

  if (error) {
    console.error('Failed to refund VTU payment to customer wallet:', {
      amount: refundedAmount,
      customerId: row.customer_id,
      error: error.message,
      merchantId: row.merchant_id,
      rpc: 'refund_customer_wallet_for_vtu',
      transactionId: row.id,
    });
    return { metadataChanged: false, refundIssued: false, refundedAmount: 0 };
  }

  let metadataChanged = setMetadataValue(metadata, 'refundIssued', true);
  metadataChanged =
    setMetadataValue(metadata, 'refundAmount', refundedAmount) ||
    metadataChanged;
  metadataChanged =
    setMetadataValue(metadata, 'refundedAt', new Date().toISOString()) ||
    metadataChanged;

  return { metadataChanged, refundIssued: true, refundedAmount };
}

export class VtuPersistenceError extends Error {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, VtuPersistenceError.prototype);
    this.name = 'VtuPersistenceError';
  }
}

function throwVtuPersistenceError(message: string): never {
  throw new VtuPersistenceError(message);
}

const PURCHASE_RESULT_UPDATE_MAX_ATTEMPTS = 3;
const PURCHASE_RESULT_UPDATE_BACKOFF_MS = [100, 250] as const;

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }

  return String(error);
}

function waitForRetryBackoff(delayMs: number) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function updateVtuPurchaseResultWithRetry({
  payload,
  row,
  supabase,
}: {
  payload: {
    error_message: string | null;
    metadata: Record<string, unknown>;
    status: 'successful' | 'failed';
    transaction_id: string | null;
  };
  row: VtuTransactionRow;
  supabase: SupabaseClient;
}) {
  let lastError: unknown = null;

  for (
    let attempt = 1;
    attempt <= PURCHASE_RESULT_UPDATE_MAX_ATTEMPTS;
    attempt += 1
  ) {
    const { error } = await supabase
      .from('vtu_transactions')
      .update(payload)
      .eq('id', row.id);

    if (!error) {
      return null;
    }

    lastError = error;
    if (attempt >= PURCHASE_RESULT_UPDATE_MAX_ATTEMPTS) {
      break;
    }

    const delayMs =
      PURCHASE_RESULT_UPDATE_BACKOFF_MS[
        Math.min(attempt - 1, PURCHASE_RESULT_UPDATE_BACKOFF_MS.length - 1)
      ];
    console.warn(
      'Retrying VTU purchase result persistence after failed update:',
      {
        attempt,
        delayMs,
        error: getErrorMessage(error),
        maxAttempts: PURCHASE_RESULT_UPDATE_MAX_ATTEMPTS,
        status: payload.status,
        transactionId: row.id,
        transactionReference: payload.transaction_id,
      }
    );
    await waitForRetryBackoff(delayMs);
  }

  return lastError;
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
    throwVtuPersistenceError('Failed to check existing VTU cashback ledger');
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
    throwVtuPersistenceError(
      'Failed to check existing VTU merchant commission'
    );
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

  // Ledger lookups are the idempotency guard when successful fulfillment is re-entered.
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
      if (error) {
        console.error('Failed to credit VTU merchant wallet:', {
          amount: row.amount,
          error: error.message,
          merchantCommission,
          merchantId: row.merchant_id,
          provider: getVtuProviderLabel(row),
          rpc: 'credit_merchant_wallet',
          transactionId: row.id,
          type: row.type,
        });
      }
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
        const nextBalance = getCreditWalletNewBalance(data);
        customerNewBalance = coerceNumber(nextBalance);
      } else {
        console.error('Failed to credit VTU customer wallet:', {
          cashbackAmount,
          customerId: row.customer_id,
          error: error.message,
          merchantId: row.merchant_id,
          rpc: 'credit_customer_wallet',
          transactionId: row.id,
        });
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

async function claimCustomerNotificationAttempt({
  metadata,
  row,
  supabase,
}: {
  metadata: Record<string, unknown>;
  row: VtuTransactionRow;
  supabase: SupabaseClient;
}) {
  if (metadata.customerNotificationAttempted === true) {
    return false;
  }

  const claimedMetadata = { ...metadata };
  setMetadataValue(claimedMetadata, 'customerNotificationAttempted', true);

  const { data, error } = await supabase
    .from('vtu_transactions')
    .update({ metadata: claimedMetadata })
    .eq('id', row.id)
    .or(
      'metadata->>customerNotificationAttempted.is.null,metadata->>customerNotificationAttempted.neq.true'
    )
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('Failed to claim VTU customer notification attempt:', {
      error: error.message,
      transactionId: row.id,
    });
    return false;
  }

  if (!data) {
    return false;
  }

  Object.assign(metadata, claimedMetadata);
  return true;
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

  const claimedNotification = await claimCustomerNotificationAttempt({
    metadata,
    row,
    supabase,
  });
  if (!claimedNotification) {
    return { metadataChanged: false };
  }

  const label = VTU_TYPE_LABELS[row.type];
  const provider = getVtuProviderLabel(row);
  const baseBody = `Your ${provider} ${label.toLowerCase()} purchase of ${formatNaira(Number(row.amount) || 0)} was successful.`;
  const cashbackBody =
    cashbackAmount > 0 && customerWalletCredited
      ? ` ${formatNaira(cashbackAmount)} cashback was credited to your wallet.`
      : '';

  let metadataChanged = true;

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

    metadataChanged =
      setMetadataValue(metadata, 'customerNotificationSent', result.sent > 0) ||
      metadataChanged;
    return { metadataChanged };
  } catch (error) {
    console.error('Failed to send VTU success notification:', {
      error: error instanceof Error ? error.message : String(error),
      transactionId: row.id,
    });
    metadataChanged =
      setMetadataValue(metadata, 'customerNotificationSent', false) ||
      metadataChanged;
    return { metadataChanged };
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

    const { error } = await supabase.rpc('set_vtu_transaction_voucher_pin', {
      p_transaction_id: transactionId,
      p_voucher_pin: voucherPin,
    });

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

async function resolveSuccessfulVtuTransaction({
  reconciledVoucherPin,
  row,
  supabase,
}: {
  reconciledVoucherPin?: string;
  row: VtuTransactionRow;
  supabase: SupabaseClient;
}): Promise<FulfilledVtuResult> {
  const metadata = { ...(row.metadata ?? {}) };
  let metadataChanged = false;
  const cashbackAmount = Number(row.customer_cashback ?? 0);
  const voucherPin =
    normalizeVoucherPin(reconciledVoucherPin) ??
    (canResolveBillVoucherPin(row.type)
      ? await backfillVtuVoucherPin({
          billRequestRef: row.request_reference,
          billResponseReference: row.transaction_id,
          metadata: row.metadata,
          supabase,
          transactionId: row.id,
        })
      : getVoucherPinFromMetadata(row.metadata));
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
    const { error: metadataUpdateError } = await supabase
      .from('vtu_transactions')
      .update({ metadata })
      .eq('id', row.id);

    if (metadataUpdateError) {
      console.error('Failed to persist VTU transaction metadata:', {
        error: metadataUpdateError.message,
        metadata: getSafeMetadataDiagnostics(metadata),
        transactionId: row.id,
      });
    }
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

async function reconcileFailedVtuRetry({
  row,
  supabase,
}: {
  row: VtuTransactionRow;
  supabase: SupabaseClient;
}): Promise<
  { action: 'retry' } | { action: 'return'; result: FulfilledVtuResult }
> {
  try {
    const providerStatus = await checkTransactionStatus(
      row.transaction_id ?? undefined,
      row.request_reference || undefined
    );
    const reconciledStatus = normalizeProviderStatus(providerStatus.status);

    if (reconciledStatus === 'failed') {
      return { action: 'retry' };
    }

    if (reconciledStatus === 'successful') {
      const { data: reconciled, error } = await supabase
        .from('vtu_transactions')
        .update({ error_message: null, status: 'successful' })
        .eq('id', row.id)
        .eq('status', 'failed')
        .select('id')
        .maybeSingle();

      if (error) {
        throw new VtuPersistenceError(
          `Failed to reconcile VTU transaction ${row.id}: ${error.message}`
        );
      }

      if (!reconciled) {
        const { data: current } = await supabase
          .from('vtu_transactions')
          .select('error_message, status')
          .eq('id', row.id)
          .single();
        const currentStatus = normalizeDbVtuStatus(current?.status);
        if (currentStatus === 'successful') {
          return {
            action: 'return',
            result: await resolveSuccessfulVtuTransaction({
              reconciledVoucherPin: providerStatus.pin,
              row: { ...row, error_message: null, status: 'successful' },
              supabase,
            }),
          };
        }

        if (currentStatus === 'failed') {
          return {
            action: 'return',
            result: {
              amount: Number(row.amount) || 0,
              error:
                typeof current?.error_message === 'string'
                  ? current.error_message
                  : row.error_message || 'Purchase failed',
              reference: row.request_reference,
              status: 'failed',
            },
          };
        }

        return {
          action: 'return',
          result: {
            amount: Number(row.amount) || 0,
            reference: row.request_reference,
            status: 'processing',
          },
        };
      }

      return {
        action: 'return',
        result: await resolveSuccessfulVtuTransaction({
          reconciledVoucherPin: providerStatus.pin,
          row: { ...row, error_message: null, status: 'successful' },
          supabase,
        }),
      };
    }

    return {
      action: 'return',
      result: {
        amount: Number(row.amount) || 0,
        error:
          reconciledStatus === 'processing'
            ? 'Original utility purchase is still processing with the provider'
            : 'Unable to reconcile failed utility purchase with the provider',
        reference: row.request_reference,
        status: 'failed',
      },
    };
  } catch (error) {
    console.error('Failed to reconcile failed VTU transaction before retry:', {
      error: error instanceof Error ? error.message : String(error),
      transactionId: row.id,
    });
    return {
      action: 'return',
      result: {
        amount: Number(row.amount) || 0,
        error: 'Unable to reconcile failed utility purchase with the provider',
        reference: row.request_reference,
        status: 'failed',
      },
    };
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
    row.request_reference,
    // For electricity/cable_tv/betting, customer_identifier is a meter / decoder
    // / wallet — not a phone. Forward the captured customer phone so Kuda's SMS
    // token delivery (and any biller-side phone validation) works correctly.
    row.phone_number || undefined
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
      'id, merchant_id, customer_id, type, network_provider, phone_number, amount, request_reference, transaction_id, status, metadata, error_message, merchant_commission, customer_cashback, biller_name, biller_item_code, customer_identifier, source'
    )
    .eq('id', transactionId)
    .single();

  if (existingError || !existing) {
    throw new Error('VTU transaction not found');
  }

  const row = existing as VtuTransactionRow;
  if (row.status === 'successful') {
    return resolveSuccessfulVtuTransaction({ row, supabase });
  }

  if (row.status === 'failed' && !retryFailed) {
    // Existing failed row — issue (or confirm) the wallet refund so the
    // customer can retry from wallet credit. Idempotent.
    const refundMetadata = { ...(row.metadata ?? {}) };
    const refund = await refundVtuToCustomerWallet({
      metadata: refundMetadata,
      row,
      supabase,
    });
    if (refund.metadataChanged) {
      const { error: refundMetadataUpdateError } = await supabase
        .from('vtu_transactions')
        .update({ metadata: refundMetadata })
        .eq('id', row.id);
      if (refundMetadataUpdateError) {
        console.error('Failed to persist VTU refund metadata:', {
          error: refundMetadataUpdateError.message,
          metadata: getSafeMetadataDiagnostics(refundMetadata),
          transactionId: row.id,
        });
      }
    }
    return {
      amount: Number(row.amount) || 0,
      error: row.error_message || 'Purchase failed',
      reference: row.request_reference,
      ...(refund.refundIssued && { refundedToWallet: refund.refundedAmount }),
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

  if (row.status === 'failed' && retryFailed) {
    const reconciliation = await reconcileFailedVtuRetry({ row, supabase });
    if (reconciliation.action === 'return') {
      return reconciliation.result;
    }
  }

  const claimableStatus =
    row.status === 'failed' && retryFailed ? 'failed' : 'pending';
  const { data: claimed, error: claimUpdateError } = await supabase
    .from('vtu_transactions')
    .update({ error_message: null, status: 'processing' })
    .eq('id', transactionId)
    .eq('status', claimableStatus)
    .select('id')
    .maybeSingle();

  if (claimUpdateError) {
    console.error('Failed to claim VTU transaction for fulfillment:', {
      error: claimUpdateError.message,
      payload: { error_message: null, status: 'processing' },
      transactionId,
    });
    throw new VtuPersistenceError(
      `Failed to claim VTU transaction ${transactionId}: ${claimUpdateError.message}`
    );
  }

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

  const purchaseUpdatePayload: {
    error_message: string | null;
    metadata: Record<string, unknown>;
    status: 'successful' | 'failed';
    transaction_id: string | null;
  } = {
    error_message: result.success ? null : result.message,
    metadata: updatedMetadata,
    status: result.success ? 'successful' : 'failed',
    transaction_id: result.transactionId ?? row.transaction_id,
  };
  const purchaseUpdateError = await updateVtuPurchaseResultWithRetry({
    payload: purchaseUpdatePayload,
    row,
    supabase,
  });

  if (purchaseUpdateError) {
    console.error('Failed to persist VTU purchase result:', {
      attempts: PURCHASE_RESULT_UPDATE_MAX_ATTEMPTS,
      errorMessage: purchaseUpdatePayload.error_message,
      error: getErrorMessage(purchaseUpdateError),
      metadata: getSafeMetadataDiagnostics(updatedMetadata),
      persistenceRetryExhausted: true,
      status: purchaseUpdatePayload.status,
      transactionId: row.id,
      transactionReference: purchaseUpdatePayload.transaction_id,
    });
    throwVtuPersistenceError('Failed to persist VTU purchase result');
  }

  if (!result.success) {
    // Fresh vend failure: refund the customer wallet so they can retry from
    // credit. Idempotent at the RPC layer; safe to call on retries.
    const refundMetadata = { ...updatedMetadata };
    const refund = await refundVtuToCustomerWallet({
      metadata: refundMetadata,
      row,
      supabase,
    });
    if (refund.metadataChanged) {
      const { error: refundMetadataUpdateError } = await supabase
        .from('vtu_transactions')
        .update({ metadata: refundMetadata })
        .eq('id', row.id);
      if (refundMetadataUpdateError) {
        console.error('Failed to persist VTU refund metadata:', {
          error: refundMetadataUpdateError.message,
          metadata: getSafeMetadataDiagnostics(refundMetadata),
          transactionId: row.id,
        });
      }
    }
    return {
      amount: Number(row.amount) || 0,
      error: result.message,
      reference: row.request_reference,
      ...(refund.refundIssued && { refundedToWallet: refund.refundedAmount }),
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
  const notificationSettlement = await notifyVtuCustomerSuccess({
    cashbackAmount,
    customerWalletCredited: walletSettlement.customerWalletCredited,
    metadata: finalMetadata,
    row,
    supabase,
  });
  const paymentPendingMetadataChanged = setMetadataValue(
    finalMetadata,
    'paymentPending',
    false
  );
  const metadataChanged =
    walletSettlement.metadataChanged ||
    notificationSettlement.metadataChanged ||
    paymentPendingMetadataChanged;

  if (metadataChanged) {
    const finalMetadataUpdatePayload = {
      metadata: finalMetadata,
    };
    const { error: finalMetadataUpdateError } = await supabase
      .from('vtu_transactions')
      .update(finalMetadataUpdatePayload)
      .eq('id', row.id);

    if (finalMetadataUpdateError) {
      console.error('Failed to persist final VTU transaction metadata:', {
        error: finalMetadataUpdateError.message,
        metadata: getSafeMetadataDiagnostics(finalMetadata),
        transactionId: row.id,
      });
    }
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
