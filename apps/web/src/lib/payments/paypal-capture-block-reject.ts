import 'server-only';

import { NextResponse } from 'next/server';
import { filePaypalCapturePersistFailureReview } from '@/lib/payments/file-paypal-capture-persist-failure-review';
import {
  type PaypalCaptureContext,
  refundCapturedPaypalOrder,
  successResponse,
} from '@/lib/payments/paypal-capture-execute';
import type { PaypalCaptureOutcome } from '@/lib/payments/paypal-capture-outcome';
import {
  isProvenDuplicate,
  type PaypalSettlerVerdict,
} from '@/lib/payments/paypal-settler-verdict';
import type { PayPalOrderDetails } from '@/lib/paypal';

/**
 * The block / reject outcome handlers of the PayPal capture funnel (see
 * docs/payments/paypal-capture-reconciliation-design.md §6). Split out of the
 * dispatcher to keep each module under the 300-line cap; neither of these calls
 * back into the dispatcher, so there is no cycle.
 */

/**
 * F-203: the order was settled by something other than this capture. Never
 * capture again. Return idempotent success — the order IS paid, so the buyer
 * proceeds.
 *
 * A landed capture is auto-refunded ONLY on positive proof of a different
 * settler (`other_txn`). When the settler is `unknown` (no marker — e.g. a
 * pre-migration paid order) we must NOT claw the money back: absence of a marker
 * is not evidence of duplication, and the capture may well be the payment that
 * settled this order. Those get a manual-review row instead.
 */
export async function handleBlockPaidElsewhere(
  ctx: PaypalCaptureContext,
  captured: boolean,
  remote: PayPalOrderDetails | undefined,
  settlerVerdict: PaypalSettlerVerdict
): Promise<NextResponse> {
  if (captured && isProvenDuplicate(settlerVerdict)) {
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
        settlerVerdict,
        refundSucceeded: refund.success,
        refundError: refund.error ?? null,
      },
    });
  } else if (captured) {
    // Captured, but we cannot PROVE a different transaction settled the order
    // (no marker). Refunding could claw back a legitimate payment, so leave the
    // money alone and escalate to a human.
    await filePaypalCapturePersistFailureReview({
      gatewayReference: ctx.paypalOrderId,
      merchantId: ctx.merchantId,
      orderId: ctx.orderId,
      reason:
        'PayPal capture landed on an already-settled order with no settler marker; needs manual reconciliation (NOT auto-refunded)',
      transactionId: ctx.transaction.id,
      metadata: {
        stage: 'captured_on_settled_order_unknown_settler',
        settlerVerdict,
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
