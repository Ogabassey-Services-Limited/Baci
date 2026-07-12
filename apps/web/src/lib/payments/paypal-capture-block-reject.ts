import 'server-only';

import { NextResponse } from 'next/server';
import { filePaypalCapturePersistFailureReview } from '@/lib/payments/file-paypal-capture-persist-failure-review';
import {
  type PaypalCaptureContext,
  refundCapturedPaypalOrder,
  successResponse,
} from '@/lib/payments/paypal-capture-execute';
import type { PaypalCaptureOutcome } from '@/lib/payments/paypal-capture-outcome';
import type { PayPalOrderDetails } from '@/lib/paypal';

/**
 * The block / reject outcome handlers of the PayPal capture funnel (see
 * docs/payments/paypal-capture-reconciliation-design.md §6). Split out of the
 * dispatcher to keep each module under the 300-line cap; neither of these calls
 * back into the dispatcher, so there is no cycle.
 */

/**
 * F-203: the order was settled by another tender/PayPal order while this stale
 * approval returned. Never capture. If this stale order already captured,
 * auto-refund it and file `captured_after_settlement`. Return idempotent
 * success — the order IS paid, so the buyer proceeds.
 */
export async function handleBlockPaidElsewhere(
  ctx: PaypalCaptureContext,
  captured: boolean,
  remote: PayPalOrderDetails | undefined
): Promise<NextResponse> {
  if (captured) {
    const refund = await refundCapturedPaypalOrder(
      ctx,
      remote,
      'Duplicate PayPal capture on an already-settled order'
    );
    await filePaypalCapturePersistFailureReview({
      gatewayReference: ctx.paypalOrderId,
      merchantId: ctx.merchantId,
      orderId: ctx.orderId,
      reason:
        'PayPal captured after the order was already settled by another tender or PayPal order',
      transactionId: ctx.transaction.id,
      metadata: {
        stage: 'captured_after_settlement',
        refundSucceeded: refund.success,
        refundError: refund.error ?? null,
      },
    });
  } else {
    // Approved-but-uncaptured stale order; PayPal exposes no void in this lib,
    // so file for a manual void rather than silently proceeding.
    await filePaypalCapturePersistFailureReview({
      gatewayReference: ctx.paypalOrderId,
      merchantId: ctx.merchantId,
      orderId: ctx.orderId,
      reason:
        'Approved PayPal order on an already-settled order; needs a manual void',
      transactionId: ctx.transaction.id,
      metadata: { stage: 'stale_approval_on_settled_order' },
    });
  }
  return successResponse(ctx);
}

/**
 * F-194: the order total (or a prepaid tender) moved after the PayPal order was
 * minted, so the captured/approved residual no longer matches. Reject; refund +
 * review if already captured. The client must mint a fresh order for the new
 * residual.
 */
export async function handleRejectAmount(
  ctx: PaypalCaptureContext,
  outcome: Extract<
    PaypalCaptureOutcome,
    { kind: 'reject_underpayment' | 'reject_overpayment' }
  >,
  remote: PayPalOrderDetails | undefined
): Promise<NextResponse> {
  if (outcome.captured) {
    const refund = await refundCapturedPaypalOrder(
      ctx,
      remote,
      'PayPal captured a stale amount; refunding'
    );
    await filePaypalCapturePersistFailureReview({
      gatewayReference: ctx.paypalOrderId,
      merchantId: ctx.merchantId,
      orderId: ctx.orderId,
      reason:
        outcome.kind === 'reject_underpayment'
          ? 'PayPal captured an underpayment (order total changed after mint)'
          : 'PayPal captured an overpayment (order total changed after mint)',
      transactionId: ctx.transaction.id,
      metadata: {
        stage: 'amount_stale',
        kind: outcome.kind,
        refundSucceeded: refund.success,
        refundError: refund.error ?? null,
      },
    });
  }
  return NextResponse.json(
    {
      error: 'The order total changed; please restart PayPal checkout',
      code: 'PAYPAL_AMOUNT_STALE',
    },
    { status: 409 }
  );
}
