import type { SupabaseClient } from '@supabase/supabase-js';
import { buildPaidAgenticDvaMetadata } from '@/lib/agentic/paystack-dva-paid-metadata';
import { isAgenticDvaSessionMetadata } from '@/lib/agentic/paystack-dva-session-metadata';

type VerifiedAmount = { amount: number; currency?: string };

type AgenticDvaPaymentResult =
  | { handled: false }
  | { body: Record<string, unknown>; handled: true; status: number };

const PAYSTACK_ACCOUNT_PATTERN = /^\d{6,20}$/;
const POSTGRES_UNIQUE_VIOLATION = '23505';
const DEFAULT_CURRENCY = 'NGN';

export function getPaystackDvaReceiverAccountNumber(
  payload: unknown
): string | null {
  if (!payload || typeof payload !== 'object' || !('data' in payload)) {
    return null;
  }

  const data = (payload as { data?: unknown }).data;
  if (!data || typeof data !== 'object') {
    return null;
  }

  const dataRecord = data as Record<string, unknown>;
  const authorization = dataRecord.authorization;
  const authorizationRecord =
    authorization && typeof authorization === 'object'
      ? (authorization as Record<string, unknown>)
      : {};
  const candidates = [
    authorizationRecord.receiver_bank_account_number,
    authorizationRecord.receiver_account_number,
    dataRecord.receiver_bank_account_number,
    dataRecord.receiver_account_number,
  ];
  const accountNumber = candidates.find(
    (value): value is string =>
      typeof value === 'string' && PAYSTACK_ACCOUNT_PATTERN.test(value)
  );

  return accountNumber ?? null;
}

export async function confirmAgenticPaystackDvaPayment({
  accountNumber,
  gatewayReference,
  supabase,
  verifiedAmount,
}: {
  accountNumber: string | null;
  gatewayReference: string;
  supabase: SupabaseClient;
  verifiedAmount: VerifiedAmount | null;
}): Promise<AgenticDvaPaymentResult> {
  if (!accountNumber || !PAYSTACK_ACCOUNT_PATTERN.test(accountNumber)) {
    return { handled: false };
  }

  const { data: existingTransaction, error: existingTransactionError } =
    await supabase
      .from('transactions')
      .select('id')
      .eq('gateway_reference', gatewayReference)
      .maybeSingle();
  if (existingTransactionError) {
    return {
      body: { error: 'Agentic payment transaction lookup failed' },
      handled: true,
      status: 500,
    };
  }
  if (existingTransaction) {
    return { handled: false };
  }

  const sessionSelect =
    'id, session_id, merchant_id, order_id, total_amount, currency, status, metadata';
  const { data: candidateSessions, error: sessionError } = await supabase
    .from('checkout_sessions')
    .select(sessionSelect)
    // Safe to interpolate after PAYSTACK_ACCOUNT_PATTERN validates digits only.
    .or(
      `payment_reference.eq.${accountNumber},virtual_account_number.eq.${accountNumber}`
    )
    .in('status', ['processing', 'completed'])
    .limit(2);
  if (sessionError) {
    return {
      body: { error: 'Agentic checkout session lookup failed' },
      handled: true,
      status: 500,
    };
  }
  const agenticSessions = normalizeSessionRows(candidateSessions).filter(
    (candidate) =>
      isAgenticDvaSessionMetadata({
        accountNumber,
        metadata: (candidate as { metadata?: unknown }).metadata,
      })
  );
  if (agenticSessions.length > 1) {
    return {
      body: { error: 'Ambiguous agentic checkout payment account' },
      handled: true,
      status: 409,
    };
  }
  const session = agenticSessions[0] ?? null;
  if (!session) {
    return { handled: false };
  }

  const checkoutSession = session as {
    currency?: string | null;
    merchant_id: string;
    metadata?: unknown;
    order_id?: string | null;
    session_id: string;
    status?: string | null;
    total_amount?: number | string | null;
  };
  if (checkoutSession.status === 'completed') {
    return {
      body: { message: 'Agentic checkout payment already processed' },
      handled: true,
      status: 200,
    };
  }
  if (!verifiedAmount || !Number.isFinite(verifiedAmount.amount)) {
    return {
      body: { error: 'Payment amount verification unavailable' },
      handled: true,
      status: 400,
    };
  }
  const expectedAmount = Number.parseFloat(
    String(checkoutSession.total_amount ?? '0')
  );
  if (!Number.isFinite(expectedAmount)) {
    return {
      body: { error: 'Invalid agentic checkout total amount' },
      handled: true,
      status: 500,
    };
  }
  if (
    toMinorCurrencyUnit(verifiedAmount.amount) !==
      toMinorCurrencyUnit(expectedAmount) ||
    (verifiedAmount.currency &&
      checkoutSession.currency &&
      verifiedAmount.currency.toUpperCase() !==
        checkoutSession.currency.toUpperCase())
  ) {
    return {
      body: {
        error: 'Payment amount mismatch',
      },
      handled: true,
      status: 400,
    };
  }

  if (!checkoutSession.order_id) {
    return {
      body: {
        error: 'Agentic checkout order not found',
      },
      handled: true,
      status: 409,
    };
  }
  const { error: transactionError } = await supabase
    .from('transactions')
    .insert({
      amount: expectedAmount.toString(),
      currency: checkoutSession.currency ?? DEFAULT_CURRENCY,
      description: `Agentic checkout payment for session ${checkoutSession.session_id}`,
      gateway: 'paystack',
      gateway_reference: gatewayReference,
      merchant_id: checkoutSession.merchant_id,
      metadata: {
        agentic_checkout_session_id: checkoutSession.session_id,
        agentic_virtual_account_number: accountNumber,
        transaction_type: 'agentic_checkout_payment',
      },
      order_id: checkoutSession.order_id,
      status: 'pending',
      transaction_type: 'payment',
    });

  if (transactionError && transactionError.code !== POSTGRES_UNIQUE_VIOLATION) {
    return {
      body: { error: 'Agentic payment transaction creation failed' },
      handled: true,
      status: 500,
    };
  }
  // Return to the standard Paystack webhook path after reserving the pending
  // transaction. That path owns gateway verification and atomically claims
  // `.neq('status', 'completed')` before settlement side effects.
  return { handled: false };
}

function toMinorCurrencyUnit(amount: number): number {
  return Math.round(amount * 100);
}

export async function markAgenticPaystackDvaSessionPaid({
  gatewayReference,
  supabase,
  transaction,
}: {
  gatewayReference: string;
  supabase: SupabaseClient;
  transaction: {
    merchant_id: string;
    metadata: unknown;
    order_id: string | null;
  };
}): Promise<{ error?: unknown; ok: boolean; skipped?: boolean }> {
  const metadata = toRecord(transaction.metadata);
  if (metadata.transaction_type !== 'agentic_checkout_payment') {
    return { ok: true, skipped: true };
  }
  const sessionId = metadata.agentic_checkout_session_id;
  const accountNumber = metadata.agentic_virtual_account_number;
  if (
    typeof sessionId !== 'string' ||
    typeof accountNumber !== 'string' ||
    !transaction.order_id
  ) {
    return { error: 'Invalid agentic payment transaction metadata', ok: false };
  }
  const { data: session, error: sessionError } = await supabase
    .from('checkout_sessions')
    .select('metadata, status')
    .eq('session_id', sessionId)
    .eq('merchant_id', transaction.merchant_id)
    .eq('order_id', transaction.order_id)
    .maybeSingle();

  if (sessionError || !session) {
    return {
      error: sessionError ?? 'Agentic checkout session not found',
      ok: false,
    };
  }
  if ((session as { status?: string | null }).status === 'completed') {
    return { ok: true, skipped: true };
  }
  if (
    !isAgenticDvaSessionMetadata({
      accountNumber,
      metadata: (session as { metadata?: unknown }).metadata,
    })
  ) {
    return { ok: true, skipped: true };
  }
  const { data, error } = await supabase
    .from('checkout_sessions')
    .update({
      metadata: buildPaidAgenticDvaMetadata({
        accountNumber,
        gatewayReference,
        metadata: (session as { metadata?: unknown }).metadata,
      }),
      status: 'completed',
    })
    .eq('session_id', sessionId)
    .eq('merchant_id', transaction.merchant_id)
    .eq('order_id', transaction.order_id)
    .select('session_id')
    .maybeSingle();

  if (error || !data) {
    return {
      error: error ?? 'Agentic checkout session was not updated',
      ok: false,
    };
  }
  return {
    ok: true,
  };
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeSessionRows(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  return value ? [value] : [];
}
