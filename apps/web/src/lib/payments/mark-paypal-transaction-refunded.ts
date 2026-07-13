import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Makes a refunded PayPal capture NON-SETTLEABLE.
 *
 * Refunding the money is only half the job: if the transaction row stays
 * `pending`/`completed`, a later retry can pick the SAME PayPal order back up,
 * see it COMPLETED at PayPal, and settle the order against a capture we already
 * gave back — charging the merchant for money they no longer hold.
 *
 * `loadPaypalCaptureContext` only admits `pending` and `completed` transactions,
 * so stamping `refunded` here is what closes every settle path at the door
 * (capture route, /verify, create-order reconcile) rather than relying on each
 * one to remember the check.
 *
 * Best-effort by design: the refund itself already succeeded, so a failure to
 * stamp must not throw away that outcome — but it IS loud, because a refunded
 * capture that still looks settleable is exactly the state we are trying to
 * eliminate.
 */
export async function markPaypalTransactionRefunded(
  supabase: SupabaseClient | undefined,
  transactionId: string,
  reason: string
): Promise<void> {
  const client = supabase ?? createServiceClient();
  try {
    const { error } = await client
      .from('transactions')
      .update({
        status: 'refunded',
        updated_at: new Date().toISOString(),
      })
      .eq('id', transactionId)
      // Never walk a terminal row backwards.
      .in('status', ['pending', 'completed']);

    if (error) {
      logger.error({
        message:
          'PayPal refund: failed to mark the refunded capture terminal; it may still look settleable',
        error,
        transactionId,
        reason,
      });
    }
  } catch (error) {
    logger.error({
      message: 'PayPal refund: marking the refunded capture terminal threw',
      error,
      transactionId,
      reason,
    });
  }
}
