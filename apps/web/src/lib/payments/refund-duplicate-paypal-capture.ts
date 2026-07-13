import 'server-only';

import { NextResponse } from 'next/server';
import { filePaypalCapturePersistFailureReview } from '@/lib/payments/file-paypal-capture-persist-failure-review';
import { markPaypalTransactionRefunded } from '@/lib/payments/mark-paypal-transaction-refunded';
import { initiatePaypalOrderRefund } from '@/lib/payments/paypal-order-refund';

/**
 * Shared handler for a PayPal capture that was completed but is NOT the one that
 * settled its order (docs/payments/paypal-capture-reconciliation-design.md §6,
 * the block_paid_elsewhere family). It refunds the captured funds and files a
 * review, then returns idempotent success because the order IS paid.
 *
 * Two callers reach this with the authoritative
 * `orders.paid_transaction_id !== thisTransactionId` signal (set atomically in
 * the reconcile CAS, so it survives a lost split/metadata write):
 *  - `/verify`, when a completed PayPal txn arrives on an already-paid order it
 *    did not settle (source: 'verify');
 *  - the reconcile writer's CAS-loser branch, when this request captured PayPal
 *    funds but another tender/PayPal order won the paid-CAS first
 *    (source: 'reconcile').
 */
export async function refundDuplicatePaypalCapture(input: {
  merchantId: string;
  orderId: string;
  transactionId: string;
  gatewayReference: string | null;
  gatewayResponse: unknown;
  orderNumber: string | null;
  source:
    | 'verify'
    | 'reconcile'
    | 'reconcile_refunded_order'
    /** Capture landed on an order the abandoned-checkout cron already cancelled. */
    | 'reconcile_cancelled_order'
    /** Capture landed on an order the buyer had already financed with BNPL. */
    | 'reconcile_bnpl_order';
}): Promise<NextResponse> {
  const {
    merchantId,
    orderId,
    transactionId,
    gatewayReference,
    gatewayResponse,
    orderNumber,
    source,
  } = input;

  const refund = await initiatePaypalOrderRefund({
    merchantId,
    gatewayResponse,
    reason: `Duplicate PayPal capture detected on ${source} for an already-settled order`,
  });

  // Close the door behind the refund: a still-`completed` row could be picked up
  // by a later retry and settled against money we just gave back. Only when the
  // capture is genuinely being reversed — a refund PayPal REFUSED leaves the funds
  // with the merchant, and stamping it refunded would both lie and block healing.
  if (refund.success || refund.pending) {
    await markPaypalTransactionRefunded(
      undefined,
      transactionId,
      `duplicate capture refunded on ${source}`
    );
  }

  await filePaypalCapturePersistFailureReview({
    gatewayReference,
    merchantId,
    orderId,
    reason:
      'PayPal capture completed on an order already settled by another tender or PayPal order',
    transactionId,
    metadata: {
      stage: 'captured_after_settlement',
      source,
      // Only a COMPLETED refund counts as succeeded. A PENDING one is reported on
      // its own so nobody reads "not succeeded" as "issue another refund" — that
      // would pay the buyer twice for the same duplicate capture.
      refundSucceeded: refund.success,
      refundPending: refund.pending ?? false,
      refundStatuses:
        refund.captures?.map((capture) => ({
          captureId: capture.captureId,
          status: capture.status ?? 'NO_RESPONSE',
          refundId: capture.refundId ?? null,
        })) ?? [],
      needsManualRefund: !refund.success && !refund.pending,
      refundError: refund.error ?? null,
    },
  });

  // The order IS paid, so the buyer proceeds; the duplicate capture is refunded
  // (or flagged for manual refund) out of band.
  return NextResponse.json({
    success: true,
    status: 'success',
    orderNumber:
      orderNumber || (gatewayReference ?? orderId).slice(0, 8).toUpperCase(),
  });
}
