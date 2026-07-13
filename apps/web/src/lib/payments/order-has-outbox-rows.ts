import type { SupabaseClient } from '@supabase/supabase-js';

export interface OrderOutboxState {
  // Any payment_side_effects rows exist. The atomic RPC seeds one in the
  // same transaction as every order flip, so `false` exactly identifies
  // legacy (pre-outbox inline) completions.
  hasRows: boolean;
  // Only the RPC's untouched seed row exists: no side-effect run has ever
  // progressed past the flip, so the (claim-less) push notifications were
  // never scheduled either.
  onlyUntouchedSeed: boolean;
}

export async function getOrderOutboxState(
  supabase: SupabaseClient,
  orderId: string
): Promise<OrderOutboxState> {
  const { data, error } = await supabase
    .from('payment_side_effects')
    .select('step, status, error')
    .eq('order_id', orderId)
    .limit(10);
  if (error) {
    // Fail toward draining without re-notifying: claims still dedupe
    // genuinely completed steps.
    return { hasRows: true, onlyUntouchedSeed: false };
  }
  const rows = data ?? [];
  const hasRows = rows.length > 0;
  const onlyUntouchedSeed =
    hasRows &&
    rows.every(
      (row) => row.status === 'failed' && row.error === 'rpc_seed_pending_drain'
    );
  return { hasRows, onlyUntouchedSeed };
}
