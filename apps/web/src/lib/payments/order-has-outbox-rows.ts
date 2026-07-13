import type { SupabaseClient } from '@supabase/supabase-js';

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
}

export async function getOrderOutboxState(
  supabase: SupabaseClient,
  orderId: string
): Promise<OrderOutboxState> {
  const { data, error } = await supabase
    .from('payment_side_effects')
    .select('step, status, error, claimed_at')
    .eq('order_id', orderId)
    .limit(10);
  if (error) {
    // Fail toward draining without re-notifying: claims still dedupe
    // genuinely completed steps.
    return { hasRows: true, onlyUntouchedSeed: false };
  }
  const rows = data ?? [];
  const hasRows = rows.length > 0;
  const seedCutoff = Date.now() - SEED_OVERLAP_WINDOW_MS;
  const onlyUntouchedSeed =
    hasRows &&
    rows.every(
      (row) =>
        row.status === 'failed' &&
        row.error === 'rpc_seed_pending_drain' &&
        (typeof row.claimed_at !== 'string' ||
          new Date(row.claimed_at).getTime() < seedCutoff)
    );
  return { hasRows, onlyUntouchedSeed };
}
