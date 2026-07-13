import type { SupabaseClient } from '@supabase/supabase-js';

// True when the paid-order outbox has ever touched this order. Pure replays
// (order already paid, nothing updated) must only drain side effects when
// rows exist: orders completed by the pre-outbox `/api/payments/verify` path
// sent their email/settlement inline, and draining them would duplicate the
// customer email.
export async function orderHasSideEffectRows(
  supabase: SupabaseClient,
  orderId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('payment_side_effects')
    .select('order_id')
    .eq('order_id', orderId)
    .limit(1);
  if (error) {
    // Fail toward draining: claims still dedupe genuinely completed steps.
    return true;
  }
  return (data ?? []).length > 0;
}
