import 'server-only';

import { NextResponse } from 'next/server';
import { filePaypalCapturePersistFailureReview } from '@/lib/payments/file-paypal-capture-persist-failure-review';
import {
  handleBlockPaidElsewhere,
  handleRejectAmount,
} from '@/lib/payments/paypal-capture-block-reject';
import {
  buildPaypalCaptureState,
  buildReconcileInput,
  type PaypalCaptureContext,
  refundCapturedPaypalOrder,
  settleCompletedPaypalOrder,
  successResponse,
} from '@/lib/payments/paypal-capture-execute';
import {
  mapPaypalOrderStatus,
  type PaypalCaptureOutcome,
  resolvePaypalCaptureOutcome,
} from '@/lib/payments/paypal-capture-outcome';
import { validatePaypalCaptureSet } from '@/lib/payments/paypal-capture-validation';
import {
  isPaypalAuthFailure,
  markPaypalCredentialInvalid,
} from '@/lib/payments/paypal-checkout-credentials';
import { reconcilePaypalOrderToPaid } from '@/lib/payments/reconcile-paypal-order';
import {
  captureOrder,
  detectPayPalResponseMode,
  getOrder,
  type PayPalOrderDetails,
} from '@/lib/paypal';

/**
 * The single dispatcher for a resolved PayPal capture outcome (see
 * docs/payments/paypal-capture-reconciliation-design.md §6). Every capture-order
 * request routes through `resolvePaypalCaptureOutcome` → this function; no
 * branch re-derives the decision.
 */
export async function handlePaypalCaptureOutcome(
  ctx: PaypalCaptureContext,
  outcome: PaypalCaptureOutcome,
  remote: PayPalOrderDetails | undefined
): Promise<NextResponse> {
  switch (outcome.kind) {
    case 'already_paid_idempotent':
      return successResponse(ctx);

    case 'create_fresh':
      return NextResponse.json(
        {
          error: 'This PayPal order can no longer be approved; start a new one',
          code: 'PAYPAL_ORDER_NOT_APPROVABLE',
        },
        { status: 409 }
      );

    case 'capture_then_finalize':
      return await captureAndReconcilePaypalOrder(ctx);

    case 'reconcile_completed_unpaid':
    case 'clamp_cancelled':
      // The idempotent writer clamps a cancelled order internally.
      return await settleCompletedPaypalOrder(ctx, remote);

    case 'block_paid_elsewhere':
      return await handleBlockPaidElsewhere(
        ctx,
        outcome.captured,
        remote,
        outcome.settlerVerdict
      );

    case 'reject_underpayment':
    case 'reject_overpayment':
      return await handleRejectAmount(ctx, outcome, remote);

    default: {
      const exhaustive: never = outcome;
      return exhaustive;
    }
  }
}

/**
 * The `capture_then_finalize` execution path. Captures at PayPal, enforces the
 * mode + capture-set integrity contract, persists the completed txn, and hands
 * off to the idempotent writer. If PayPal reports the order already captured
 * (HTTP 422), it re-resolves against the live status instead of a second charge.
 */
async function captureAndReconcilePaypalOrder(
  ctx: PaypalCaptureContext
): Promise<NextResponse> {
  const captureResult = await captureOrder(
    ctx.credentials.clientId,
    ctx.credentials.secretKey,
    ctx.paypalOrderId,
    ctx.mode,
    `capture-${ctx.paypalOrderId}`
  );

  if (!captureResult.success) {
    if (isPaypalAuthFailure(captureResult.code)) {
      await markPaypalCredentialInvalid(
        ctx.merchantId,
        ctx.environment,
        captureResult.error
      );
      return NextResponse.json(
        {
          error: 'PayPal rejected the store credentials',
          code: 'INVALID_PROVIDER_CREDENTIALS',
        },
        { status: 400 }
      );
    }
    if (captureResult.code === 'HTTP_422') {
      return reResolveAfterCaptureConflict(ctx);
    }

    // We asked PayPal to take the money and did not get a clean answer back. A
    // network error, a timeout or an unparseable response is NOT evidence that the
    // capture did not happen — the request may have reached PayPal and succeeded
    // while the response died on the way home. Previously this returned a bare 500:
    // the transaction stayed `pending`, no review was filed, /verify short-circuits
    // pending PayPal rows without a live lookup, and there is no webhook and no
    // cron. The buyer's money could sit captured at the merchant with nothing in
    // the system aware of it. File it for reconciliation.
    await filePaypalCapturePersistFailureReview({
      gatewayReference: ctx.paypalOrderId,
      merchantId: ctx.merchantId,
      orderId: ctx.orderId,
      reason:
        'PayPal capture returned no definitive answer; the capture may have succeeded and needs reconciliation',
      transactionId: ctx.transaction.id,
      metadata: {
        stage: 'capture_indeterminate',
        code: captureResult.code ?? 'UNKNOWN',
        error: captureResult.error ?? null,
      },
    });

    return NextResponse.json(
      { error: captureResult.error, code: captureResult.code },
      { status: 500 }
    );
  }

  const captureData = captureResult.data;
  if (captureData.status !== 'COMPLETED') {
    // The ORDER is not completed, so PayPal did not take the money — no review
    // needed. (An order that IS completed while an individual capture inside it is
    // still PENDING is caught downstream by `validatePaypalCaptureSet`, which
    // rejects any non-COMPLETED capture and refunds.)
    return NextResponse.json(
      {
        error: `Payment not completed. Status: ${captureData.status}`,
        code: 'CAPTURE_INCOMPLETE',
      },
      { status: 400 }
    );
  }

  const detectedMode = detectPayPalResponseMode(captureData.links);
  if (detectedMode !== ctx.mode) {
    // The capture is COMPLETED, so the buyer has already been charged. Refund
    // before rejecting the checkout — otherwise a mismatched (or link-less,
    // hence `unknown`) response strands the money in the merchant's PayPal
    // account for an order we report as failed.
    const refund = await refundCapturedPaypalOrder(
      ctx,
      captureData,
      'PayPal capture environment did not match the store mode; refunding'
    );
    await filePaypalCapturePersistFailureReview({
      gatewayReference: ctx.paypalOrderId,
      merchantId: ctx.merchantId,
      orderId: ctx.orderId,
      reason:
        'PayPal capture completed but the response environment did not match the store mode',
      transactionId: ctx.transaction.id,
      metadata: {
        stage: 'mode_mismatch',
        detectedMode,
        expectedMode: ctx.mode,
        refundSucceeded: refund.success,
        refundError: refund.error ?? null,
      },
    });
    return NextResponse.json(
      { error: 'PayPal environment mismatch', code: 'PAYPAL_MODE_MISMATCH' },
      { status: 400 }
    );
  }

  const validation = validatePaypalCaptureSet(
    captureData,
    ctx.presentmentAmount ?? Number.NaN,
    ctx.presentmentCurrency
  );
  if (!validation.ok) {
    // The buyer has already been charged (capture COMPLETED). Refund the
    // captured funds before failing the checkout so we don't strand a charge
    // for an order we reject (F4).
    const refund = await refundCapturedPaypalOrder(
      ctx,
      captureData,
      'PayPal captured but the set failed validation; refunding'
    );
    await filePaypalCapturePersistFailureReview({
      gatewayReference: ctx.paypalOrderId,
      merchantId: ctx.merchantId,
      orderId: ctx.orderId,
      reason:
        'PayPal capture completed but the captured set failed validation against the stored presentment',
      transactionId: ctx.transaction.id,
      metadata: {
        stage: 'capture_amount_mismatch',
        reason: validation.reason,
        refundSucceeded: refund.success,
        refundError: refund.error ?? null,
      },
    });
    return NextResponse.json({ error: validation.reason }, { status: 400 });
  }

  const { error: txnError } = await ctx.supabase
    .from('transactions')
    .update({
      status: 'completed',
      gateway_response: captureData as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ctx.transaction.id)
    .eq('gateway', 'paypal')
    .eq('gateway_reference', ctx.paypalOrderId)
    .eq('order_id', ctx.orderId)
    .eq('merchant_id', ctx.merchantId)
    .eq('status', 'pending');

  if (txnError) {
    await filePaypalCapturePersistFailureReview({
      gatewayReference: ctx.paypalOrderId,
      merchantId: ctx.merchantId,
      orderId: ctx.orderId,
      reason: 'PayPal capture completed but transaction status update failed',
      transactionId: ctx.transaction.id,
      metadata: { stage: 'transaction_update' },
    });
    return NextResponse.json(
      {
        error: 'Failed to persist captured payment',
        code: 'CAPTURE_PERSIST_FAILED',
      },
      { status: 500 }
    );
  }

  // The race branches collapse into the CAS inside the writer.
  return reconcilePaypalOrderToPaid(buildReconcileInput(ctx));
}

/**
 * PayPal returned HTTP 422 to the capture — the order was already captured (a
 * lost txn write, a concurrent capture, or a captured-after-settlement race).
 * Re-fetch the live status and re-resolve so we reconcile / block / refund
 * instead of ever charging twice.
 */
async function reResolveAfterCaptureConflict(
  ctx: PaypalCaptureContext
): Promise<NextResponse> {
  const fetched = await getOrder(
    ctx.credentials.clientId,
    ctx.credentials.secretKey,
    ctx.paypalOrderId,
    ctx.mode
  );
  const paypalOrderStatus = fetched.success
    ? mapPaypalOrderStatus(fetched.data.status)
    : 'UNKNOWN';
  const state = buildPaypalCaptureState(ctx, paypalOrderStatus);
  const outcome = resolvePaypalCaptureOutcome(state);

  if (outcome.kind === 'capture_then_finalize') {
    // The order is not actually capturable but PayPal rejected the capture;
    // tell the client to mint a fresh order rather than looping.
    return NextResponse.json(
      {
        error: 'PayPal could not capture this order; start a new one',
        code: 'PAYPAL_ORDER_NOT_APPROVABLE',
      },
      { status: 409 }
    );
  }

  return handlePaypalCaptureOutcome(
    ctx,
    outcome,
    fetched.success ? fetched.data : undefined
  );
}
