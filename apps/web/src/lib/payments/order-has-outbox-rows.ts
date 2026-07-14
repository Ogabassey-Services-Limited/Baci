import type { SupabaseClient } from '@supabase/supabase-js';
import {
  PAID_ORDER_FETCH_FAILURE_REASON,
  SETTLEMENT_ONLY_FAILURE_REASON,
} from '@/lib/payments/paid-order-retry-persistence';

// The transitioning caller schedules push within moments of the RPC commit;
// a seed older than this can only mean that caller died first.
const SEED_OVERLAP_WINDOW_MS = 60_000;

export interface OrderOutboxState {
  // Any payment_side_effects rows exist. The atomic RPC seeds one in the
  // same transaction as every order flip, so `false` exactly identifies
  // legacy (pre-outbox inline) completions.
  hasRows: boolean;
  // Only the RPC's untouched seed row exists AND it has aged past the
  // overlap window: no side-effect run ever progressed past the flip, and
  // this is a genuine later redelivery rather than a finalizer racing the
  // transitioning caller — so the (claim-less) push notifications were
  // never sent and are owed.
  onlyUntouchedSeed: boolean;
  // Same evidence, but still within the overlap window: the transitioning
  // caller may still be running. Draining now would consume the evidence
  // and suppress push forever — callers defer instead.
  onlyFreshPrePushEvidence: boolean;
  // The transaction that PAID the order: the RPC seeds the outbox with it
  // inside the order flip, and every side-effect claim carries it. A caller
  // whose transaction differs captured funds on an order paid elsewhere.
  // Null for legacy (pre-outbox) completions, which have no rows at all.
  payerTransactionId: string | null;
}

export async function getOrderOutboxState(
  supabase: SupabaseClient,
  orderId: string
): Promise<OrderOutboxState> {
  const { data, error } = await supabase
    .from('payment_side_effects')
    .select('step, status, error, claimed_at, result, transaction_id')
    .eq('order_id', orderId)
    .limit(10);
  if (error) {
    // Fail toward draining without re-notifying: claims still dedupe
    // genuinely completed steps.
    return {
      hasRows: true,
      onlyFreshPrePushEvidence: false,
      onlyUntouchedSeed: false,
      payerTransactionId: null,
    };
  }
  const rows = data ?? [];
  const hasRows = rows.length > 0;
  const seedCutoff = Date.now() - SEED_OVERLAP_WINDOW_MS;
  const allPrePushEvidence =
    hasRows &&
    rows.every((row) => {
      if (row.status !== 'failed') {
        return false;
      }
      const resultReason =
        row.result && typeof row.result === 'object'
          ? (row.result as Record<string, unknown>).reason
          : undefined;
      // Pre-push evidence: the RPC's untouched seed, or the markers written
      // when the paid-order fetch failed before push was scheduled.
      return (
        row.error === 'rpc_seed_pending_drain' ||
        resultReason === PAID_ORDER_FETCH_FAILURE_REASON
      );
    });
  const allAged =
    allPrePushEvidence &&
    rows.every(
      (row) =>
        typeof row.claimed_at !== 'string' ||
        new Date(row.claimed_at).getTime() < seedCutoff
    );
  // A settlement-only retry marker carries the capturing transaction, which
  // is precisely NOT the payer — exclude it.
  const payerRow = rows.find((row) => {
    if (typeof row.transaction_id !== 'string' || !row.transaction_id) {
      return false;
    }
    const resultReason =
      row.result && typeof row.result === 'object'
        ? (row.result as Record<string, unknown>).reason
        : undefined;
    return resultReason !== SETTLEMENT_ONLY_FAILURE_REASON;
  });
  return {
    hasRows,
    onlyFreshPrePushEvidence: allPrePushEvidence && !allAged,
    onlyUntouchedSeed: allAged,
    payerTransactionId: (payerRow?.transaction_id as string | null) ?? null,
  };
}
