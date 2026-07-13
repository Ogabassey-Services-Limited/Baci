import 'server-only';

import { NextResponse } from 'next/server';
import { filePaypalCapturePersistFailureReview } from '@/lib/payments/file-paypal-capture-persist-failure-review';
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
  source: 'verify' | 'reconcile' | 'reconcile_refunded_order';
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
      refundSucceeded: refund.success,
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
