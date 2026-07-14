import type { SupabaseClient } from '@supabase/supabase-js';
import { deterministicEventUuid } from '@/lib/posthog/deterministic-event-uuid';
import { captureServerEvent } from '@/lib/posthog/server';
import { WALLET_FUNDING_TELEMETRY } from '@/lib/posthog/wallet-funding-events';

export const WALLET_TOP_UP_TRANSACTION_TYPE = 'wallet_topup';
const ALLOWED_WALLET_TOP_UP_GATEWAYS = ['paystack', 'korapay'] as const;

type WalletTopUpGateway = (typeof ALLOWED_WALLET_TOP_UP_GATEWAYS)[number];

interface CreditWalletTopUpInput {
  amount: number;
  customerId: string;
  gateway: string;
  merchantId: string;
  reference: string;
  supabase: SupabaseClient;
  transactionId: string;
}

interface WalletRpcSuccess {
  success: true;
  new_balance: number | string;
  transaction_id: string;
}

interface ExistingWalletTopUpCredit {
  balance_after: number | string;
  id: string;
}

export interface CreditWalletTopUpResult {
  balance: number;
  reference: string;
  transactionId: string;
}

function assertWalletTopUpGateway(value: string): WalletTopUpGateway {
  const normalizedValue = value.toLowerCase();
  if (
    ALLOWED_WALLET_TOP_UP_GATEWAYS.includes(
      normalizedValue as WalletTopUpGateway
    )
  ) {
    return normalizedValue as WalletTopUpGateway;
  }

  throw new Error('Unsupported wallet top-up gateway');
}

function isWalletRpcSuccess(value: unknown): value is WalletRpcSuccess {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    record.success === true &&
    (typeof record.new_balance === 'number' ||
      typeof record.new_balance === 'string') &&
    typeof record.transaction_id === 'string'
  );
}

function normalizeWalletRpcResult(data: unknown): WalletRpcSuccess {
  const result = Array.isArray(data) ? data[0] : data;
  if (!isWalletRpcSuccess(result)) {
    throw new Error('Invalid wallet credit response');
  }
  return result;
}

function isExistingWalletTopUpCredit(
  value: unknown
): value is ExistingWalletTopUpCredit {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    (typeof record.balance_after === 'number' ||
      typeof record.balance_after === 'string')
  );
}

function normalizeWalletBalance(value: number | string) {
  const balance = Number(value);
  if (!Number.isFinite(balance)) {
    throw new Error('Invalid wallet balance returned after top-up');
  }

  return balance;
}

async function findExistingWalletTopUpCredit({
  customerId,
  merchantId,
  reference,
  supabase,
  transactionId,
}: Pick<
  CreditWalletTopUpInput,
  'customerId' | 'merchantId' | 'reference' | 'supabase' | 'transactionId'
>): Promise<CreditWalletTopUpResult | null> {
  const { data, error } = await supabase
    .from('customer_wallet_transactions')
    .select('balance_after, id')
    .eq('customer_id', customerId)
    .eq('merchant_id', merchantId)
    .eq('source_type', WALLET_TOP_UP_TRANSACTION_TYPE)
    .eq('source_id', transactionId)
    .eq('type', 'credit')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  if (!isExistingWalletTopUpCredit(data)) {
    throw new Error('Invalid existing wallet top-up credit response');
  }

  return {
    balance: normalizeWalletBalance(data.balance_after),
    reference,
    transactionId: data.id,
  };
}

/**
 * Reads the ledger row's `created_at` so racing emitters can stamp the SAME
 * PostHog timestamp. The `credit_customer_wallet` advisory lock hands the loser
 * the winner's ledger row, so both callers resolve `result.transaction_id` to
 * one row and therefore one `created_at` — which, paired with the deterministic
 * uuid, completes PostHog's dedupe key (uuid + event + distinct id + timestamp).
 *
 * Fail-open: the wallet has already been credited by the time we get here, so a
 * failed/missing lookup must never throw. We return `undefined` and still
 * capture the event (SDK-stamped timestamp) rather than drop it — a possible
 * duplicate is strictly better than a missing funnel completion or a broken
 * money path.
 */
async function findWalletCreditTimestamp(
  supabase: SupabaseClient,
  ledgerTransactionId: string
): Promise<Date | undefined> {
  try {
    const { data, error } = await supabase
      .from('customer_wallet_transactions')
      .select('created_at')
      .eq('id', ledgerTransactionId)
      .maybeSingle();

    if (error || !data) {
      return undefined;
    }

    const createdAt = (data as { created_at?: unknown }).created_at;
    if (typeof createdAt !== 'string') {
      return undefined;
    }

    const timestamp = new Date(createdAt);
    return Number.isNaN(timestamp.getTime()) ? undefined : timestamp;
  } catch {
    return undefined;
  }
}

export async function creditWalletTopUp({
  amount,
  customerId,
  gateway,
  merchantId,
  reference,
  supabase,
  transactionId,
}: CreditWalletTopUpInput): Promise<CreditWalletTopUpResult> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Top-up amount must be positive');
  }

  const validatedGateway = assertWalletTopUpGateway(gateway);
  // Webhooks and explicit confirmation can both arrive for the same payment.
  // Check the ledger first; the RPC repeats the same source-id guard under an
  // advisory lock so concurrent retries cannot double-credit the wallet.
  const existingCredit = await findExistingWalletTopUpCredit({
    customerId,
    merchantId,
    reference,
    supabase,
    transactionId,
  });

  if (existingCredit) {
    return existingCredit;
  }

  const { data, error } = await supabase.rpc('credit_customer_wallet', {
    p_amount: amount,
    p_customer_id: customerId,
    p_description: `Wallet top-up via ${validatedGateway}`,
    p_merchant_id: merchantId,
    p_source_id: transactionId,
    p_source_type: WALLET_TOP_UP_TRANSACTION_TYPE,
  });

  if (error) {
    throw error;
  }

  const result = normalizeWalletRpcResult(data);
  const balance = normalizeWalletBalance(result.new_balance);

  // Funnel completion. Sequential replays short-circuit on the ledger check
  // above; two CONCURRENT callers (webhook + confirm route) can both reach
  // here, but the RPC's advisory lock hands the loser the winner's ledger
  // transaction id. Both the uuid AND the timestamp are derived from that
  // shared row, which is what PostHog's dedupe key requires (uuid + event +
  // distinct id + timestamp) — a uuid alone would leave the SDK to stamp two
  // different timestamps and both events would count. Wallet top-ups are
  // NGN-only today. Fail-open + internally timeout-bounded — never blocks or
  // fails the money path.
  const creditedAt = await findWalletCreditTimestamp(
    supabase,
    result.transaction_id
  );

  await captureServerEvent(
    WALLET_FUNDING_TELEMETRY.events.transferCredited,
    {
      amount,
      currency: 'NGN',
      customer_id: customerId,
      gateway: validatedGateway,
      gateway_reference: reference,
      merchant_id: merchantId,
    },
    customerId,
    deterministicEventUuid(
      `${WALLET_FUNDING_TELEMETRY.events.transferCredited}:${result.transaction_id}`
    ),
    creditedAt
  );

  return {
    balance,
    reference,
    transactionId: result.transaction_id,
  };
}
