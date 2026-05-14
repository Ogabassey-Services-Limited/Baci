import type { SupabaseClient } from '@supabase/supabase-js';
import { buildPaidAgenticDvaMetadata } from '@/lib/agentic/paystack-dva-paid-metadata';
import { isAgenticDvaSessionMetadata } from '@/lib/agentic/paystack-dva-session-metadata';

type CheckoutSessionRow = {
  metadata: unknown;
  status: string | null;
};

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
}): Promise<{ error?: string; ok: boolean; skipped?: boolean }> {
  const metadata = toRecord(transaction.metadata);
  if (metadata.transaction_type !== 'agentic_checkout_payment') {
    return { ok: true, skipped: true };
  }
  const sessionId = metadata.agentic_checkout_session_id;
  const accountNumber = metadata.agentic_virtual_account_number;
  const orderId =
    typeof transaction.order_id === 'string' ? transaction.order_id.trim() : '';
  if (
    typeof sessionId !== 'string' ||
    typeof accountNumber !== 'string' ||
    !orderId
  ) {
    return { error: 'Invalid agentic payment transaction metadata', ok: false };
  }
  const { data: sessionData, error: sessionError } = await supabase
    .from('checkout_sessions')
    .select('metadata, status')
    .eq('session_id', sessionId)
    .eq('merchant_id', transaction.merchant_id)
    .eq('order_id', orderId)
    .maybeSingle();

  if (sessionError || !sessionData) {
    return {
      error: normalizeErrorMessage(
        sessionError,
        'Agentic checkout session not found'
      ),
      ok: false,
    };
  }
  const session = normalizeSessionRow(sessionData);
  if (!session) {
    return { error: 'Agentic checkout session not found', ok: false };
  }
  if (session.status === 'completed') {
    return { ok: true, skipped: true };
  }
  if (
    !isAgenticDvaSessionMetadata({
      accountNumber,
      metadata: session.metadata,
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
        metadata: session.metadata,
      }),
      status: 'completed',
    })
    .eq('session_id', sessionId)
    .eq('merchant_id', transaction.merchant_id)
    .eq('order_id', orderId)
    .neq('status', 'completed')
    .select('session_id')
    .maybeSingle();

  if (error) {
    return {
      error: normalizeErrorMessage(
        error,
        'Agentic checkout session was not updated'
      ),
      ok: false,
    };
  }
  if (!data) {
    return { ok: true, skipped: true };
  }
  return {
    ok: true,
  };
}

function normalizeSessionRow(value: unknown): CheckoutSessionRow | null {
  if (!isRecord(value)) return null;
  return {
    metadata: value.metadata ?? null,
    status: typeof value.status === 'string' ? value.status : null,
  };
}

function toRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeErrorMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;
  if (error instanceof Error) return error.message || fallback;
  if (isRecord(error) && typeof error.message === 'string') {
    return error.message;
  }
  return fallback;
}
