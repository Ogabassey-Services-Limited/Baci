import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

const RECONCILIATION_ISSUE_TYPE = 'payment_received_after_cancellation';
const POSTGRES_UNIQUE_VIOLATION = '23505';

/**
 * The minimal order shape needed to decide whether a finalizer's order UPDATE
 * was clamped by the `prevent_cancelled_order_reopen` BEFORE-UPDATE trigger.
 *
 * Because Postgres reflects BEFORE-trigger edits to NEW in `UPDATE ... RETURNING`,
 * a finalizer that asks to advance an already-cancelled order receives the
 * CLAMPED row back: `shipping_status` stays `'cancelled'` (and `cancelled_at`
 * remains set). Either signal marks the order as still cancelled.
 */
export interface CancellableOrderRow {
  cancelled_at?: string | null;
  id: string;
  shipping_status?: string | null;
}

/**
 * Returns true when the returned order row shows the reopen was clamped — i.e.
 * the order is still cancelled despite the finalizer asking to advance it.
 *
 * Plain boolean (not a type guard) so it does not narrow the order variable in
 * a finalizer's non-cancelled `else` branch. Callers that need a non-null row
 * should guard with `order && isOrderClampedAsCancelled(order)`.
 */
export function isOrderClampedAsCancelled(
  order: CancellableOrderRow | null | undefined
): boolean {
  if (!order) {
    return false;
  }
  return order.shipping_status === 'cancelled' || Boolean(order.cancelled_at);
}

/**
 * Records a `payment_received_after_cancellation` reconciliation_review row so
 * ops can issue a manual refund, and logs a warning. The DB trigger already
 * kept the order cancelled; this only stops the cosmetic/operational damage of
 * a paid-order finalizer running on a cancelled order.
 *
 * The partial unique index `(issue_type, order_id) WHERE resolved_at IS NULL`
 * makes a webhook retry a benign `23505` no-op — the operator already has the
 * first-fired review row.
 *
 * Never throws: the caller must still return a 2xx to the gateway so the
 * webhook is not retried into a loop. The transaction row stays recorded.
 */
export async function handlePaymentForCancelledOrder({
  gatewayReference,
  order,
  reason,
  supabase,
  transactionId,
}: {
  gatewayReference: string | null;
  order: CancellableOrderRow;
  reason: string;
  supabase: SupabaseClient;
  transactionId: string | null;
}): Promise<void> {
  logger.warn({
    cancelledAt: order.cancelled_at ?? null,
    gatewayReference,
    message:
      'Payment finalizer received a payment for a cancelled order; suppressing paid-order side effects and filing reconciliation',
    orderId: order.id,
    transactionId,
  });

  const reviewRow = {
    candidates: null,
    issue_type: RECONCILIATION_ISSUE_TYPE,
    order_id: order.id,
    paystack_ref: gatewayReference,
    reason,
    txn_id: transactionId,
  };

  const { error } = await supabase
    .from('reconciliation_review')
    .insert(reviewRow);

  if (!error) {
    return;
  }

  const isDuplicate =
    (error as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION;
  if (isDuplicate) {
    logger.info({
      gatewayReference,
      message:
        'payment_received_after_cancellation reconciliation already filed (expected retry no-op)',
      orderId: order.id,
    });
    return;
  }

  logger.error({
    error,
    gatewayReference,
    message:
      'Failed to file payment_received_after_cancellation reconciliation',
    orderId: order.id,
    transactionId,
  });
}
