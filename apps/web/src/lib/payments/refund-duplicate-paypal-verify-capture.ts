import 'server-only';

import { NextResponse } from 'next/server';
import { filePaypalCapturePersistFailureReview } from '@/lib/payments/file-paypal-capture-persist-failure-review';
import { initiatePaypalOrderRefund } from '@/lib/payments/paypal-order-refund';

/**
 * `/verify` counterpart of the capture route's `handleBlockPaidElsewhere`
 * (docs/payments/paypal-capture-reconciliation-design.md §6). It handles the
 * one case the verify already-paid fast path must NOT swallow: a PayPal
 * transaction that is `completed` on an order that is already `paid`, but which
 * did NOT settle that order (a stale/duplicate PayPal order captured after the
 * order was paid by another tender or PayPal order).
 *
 * The settling txn is the only one the writer stamps `paypal_split` onto, so a
 * completed PayPal txn WITHOUT that split on an already-paid order is a genuine
 * duplicate capture: refund the captured funds to the buyer and file a review
 * rather than returning a bare success that leaves the money stranded.
 */
export async function refundDuplicatePaypalCaptureOnVerify(input: {
  merchantId: string;
  orderId: string;
  transactionId: string;
  gatewayReference: string | null;
  gatewayResponse: unknown;
  orderNumber: string | null;
}): Promise<NextResponse> {
  const {
    merchantId,
    orderId,
    transactionId,
    gatewayReference,
    gatewayResponse,
    orderNumber,
  } = input;

  const refund = await initiatePaypalOrderRefund({
    merchantId,
    gatewayResponse,
    reason:
      'Duplicate PayPal capture detected on verify for an already-settled order',
  });

  await filePaypalCapturePersistFailureReview({
    gatewayReference,
    merchantId,
    orderId,
    reason:
      'PayPal transaction completed on an order already settled by another tender or PayPal order (detected on verify)',
    transactionId,
    metadata: {
      stage: 'captured_after_settlement',
      source: 'verify',
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
