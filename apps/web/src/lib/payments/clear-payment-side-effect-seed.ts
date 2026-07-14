import type { SupabaseClient } from '@supabase/supabase-js';

export async function clearPaymentSideEffectSeed({
  orderId,
  supabase,
  transactionId,
}: {
  orderId: string;
  supabase: SupabaseClient;
  transactionId: string;
}): Promise<void> {
  const { error } = await supabase
    .from('payment_side_effects')
    .delete()
    .eq('order_id', orderId)
    .eq('transaction_id', transactionId)
    .eq('status', 'failed')
    .eq('error', 'rpc_seed_pending_drain');

  if (error) {
    throw new Error(
      `payment_side_effect_seed_cleanup_failed: ${error.message}`
    );
  }
}
