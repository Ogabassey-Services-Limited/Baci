import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { filePaypalCapturePersistFailureReview } from '@/lib/payments/file-paypal-capture-persist-failure-review';
import { finalizePaypalCaptureOrder } from '@/lib/payments/finalize-paypal-capture-order';
import {
  loadPaypalCaptureContext,
  orderNumberFallback,
} from '@/lib/payments/load-paypal-capture-context';
import { validatePaypalCaptureSet } from '@/lib/payments/paypal-capture-validation';
import {
  getPaypalCheckoutCredentials,
  isPaypalAuthFailure,
  markPaypalCredentialInvalid,
} from '@/lib/payments/paypal-checkout-credentials';
import { captureOrder, detectPayPalResponseMode } from '@/lib/paypal';
import { createServiceClient } from '@/lib/supabase/service';
import { paypalCaptureOrderSchema } from '@/schemas/paypal-checkout';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = paypalCaptureOrderSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input parameters', details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { order_id, paypal_order_id, merchant_id, customer_email } =
      result.data;

    const supabase = createServiceClient();

    // Ported P0-security transaction/order scoping + mismatch checks; returns
    // an idempotent 200 when the transaction is already completed.
    const context = await loadPaypalCaptureContext(supabase, {
      orderId: order_id,
      paypalOrderId: paypal_order_id,
      merchantId: merchant_id,
      customerEmail: customer_email,
    });
    if (!context.proceed) {
      return NextResponse.json(context.body, { status: context.status });
    }

    const { transaction, orderSnapshot, metadata, reconcileOnly } = context;

    // F2: a prior capture already flipped the transaction to 'completed' but the
    // order never advanced to paid (that first order write failed). Do NOT
    // re-hit PayPal — funds are already captured. Reconcile the order and run
    // the side effects that never ran. Mirrors /api/payments/verify's
    // completed-transaction fall-through.
    if (reconcileOnly) {
      return finalizePaypalCaptureOrder({
        supabase,
        merchantId: merchant_id,
        orderId: order_id,
        paypalOrderId: paypal_order_id,
        transaction,
        orderSnapshot,
      });
    }

    // F6: capture with the order's ORIGINAL environment. The mode was locked in
    // at create-order time and persisted to the transaction metadata; a merchant
    // who flips paypal_mode mid-checkout must NOT flip the capture environment —
    // PayPal Orders v2 IDs are environment-scoped, so a cross-environment
    // capture 404s and moves no money. Reading the live feature config here
    // would pick the wrong vault slot and host.
    const mode = metadata?.paypal_mode === 'live' ? 'live' : 'sandbox';
    const environment = mode === 'live' ? 'live' : 'test';

    // Sandbox is reserved for the settings-page validate-on-save connection test
    // ONLY. Refuse to capture a sandbox order so a sandbox capture can never mark
    // an order paid with no real funds (F10). create-order already rejects
    // sandbox before minting, so this only fires on stale/forged sandbox state —
    // fail closed before hitting PayPal.
    if (environment !== 'live') {
      return NextResponse.json(
        {
          error: 'PayPal sandbox mode is not allowed for customer checkout',
          code: 'PAYPAL_SANDBOX_NOT_ALLOWED',
        },
        { status: 400 }
      );
    }

    // Credentials come only from the encrypted vault (Phase 2.2).
    const credentials = await getPaypalCheckoutCredentials(
      merchant_id,
      environment
    );
    if (!credentials) {
      return NextResponse.json(
        {
          error: 'PayPal is not configured for this store',
          code: 'PAYPAL_NOT_CONFIGURED',
        },
        { status: 400 }
      );
    }

    const captureResult = await captureOrder(
      credentials.clientId,
      credentials.secretKey,
      paypal_order_id,
      mode,
      `capture-${paypal_order_id}`
    );

    if (!captureResult.success) {
      // A 401 means the stored credentials are no longer valid (Phase 2.1).
      if (isPaypalAuthFailure(captureResult.code)) {
        await markPaypalCredentialInvalid(
          merchant_id,
          environment,
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
      return NextResponse.json(
        { error: captureResult.error, code: captureResult.code },
        { status: 500 }
      );
    }

    const captureData = captureResult.data;
    if (captureData.status !== 'COMPLETED') {
      return NextResponse.json(
        {
          error: `Payment not completed. Status: ${captureData.status}`,
          code: 'CAPTURE_INCOMPLETE',
        },
        { status: 400 }
      );
    }

    // Mode enforcement (Phase 2.3): PayPal's own response is authoritative.
    // Hard-reject when the response's environment disagrees with the stored
    // mode (a sandbox response for a live store, or vice versa).
    const detectedMode = detectPayPalResponseMode(captureData.links);
    if (detectedMode !== mode) {
      logger.error({
        message: 'PayPal capture: response mode mismatch',
        expectedMode: mode,
        detectedMode,
        orderId: order_id,
        paypalOrderId: paypal_order_id,
      });
      // The mismatch is detected AFTER PayPal already captured funds, so this
      // is a captured-but-rejected payment — never drop it silently. File the
      // same reconciliation row the persist-failure branches use so ops can
      // reconcile/refund by hand (Phase 2.4).
      await filePaypalCapturePersistFailureReview({
        gatewayReference: paypal_order_id,
        merchantId: merchant_id,
        orderId: order_id,
        reason:
          'PayPal capture completed but the response environment did not match the store mode',
        transactionId: transaction.id,
        metadata: { stage: 'mode_mismatch', detectedMode, expectedMode: mode },
      });
      return NextResponse.json(
        { error: 'PayPal environment mismatch', code: 'PAYPAL_MODE_MISMATCH' },
        { status: 400 }
      );
    }

    // Anchor to the stored PRESENTMENT amount/currency (NOT transactions.amount,
    // which is the order currency and differs when FX applied). Validate the
    // FULL capture set — sum every capture, reject partial/mismatched totals.
    const expectedAmount = Number(metadata?.paypal_presentment_amount);
    const expectedCurrency =
      typeof metadata?.paypal_presentment_currency === 'string'
        ? metadata.paypal_presentment_currency
        : undefined;

    const captureValidation = validatePaypalCaptureSet(
      captureData,
      expectedAmount,
      expectedCurrency
    );
    if (!captureValidation.ok) {
      // Funds are ALREADY captured (COMPLETED verified above) and the mode
      // guard passed, but the captured set does not reconcile with the stored
      // presentment (amount/currency drift, partial/split capture, or missing
      // presentment metadata → NaN). Never drop captured money silently — file
      // the same reconciliation row the sibling captured-but-failed branches
      // use so ops can reconcile/refund by hand (Phase 2.4).
      await filePaypalCapturePersistFailureReview({
        gatewayReference: paypal_order_id,
        merchantId: merchant_id,
        orderId: order_id,
        reason:
          'PayPal capture completed but the captured set failed validation against the stored presentment',
        transactionId: transaction.id,
        metadata: {
          stage: 'capture_amount_mismatch',
          reason: captureValidation.reason,
        },
      });
      return NextResponse.json(
        { error: captureValidation.reason },
        { status: 400 }
      );
    }

    const gatewayResponse = captureData as unknown as Record<string, unknown>;
    const { data: updatedTransaction, error: txnError } = await supabase
      .from('transactions')
      .update({
        status: 'completed',
        gateway_response: gatewayResponse,
        updated_at: new Date().toISOString(),
      })
      .eq('id', transaction.id)
      .eq('gateway', 'paypal')
      .eq('gateway_reference', paypal_order_id)
      .eq('order_id', order_id)
      .eq('merchant_id', merchant_id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();

    if (txnError) {
      // Money captured, DB write errored — never lose it silently (Phase 2.4).
      await filePaypalCapturePersistFailureReview({
        gatewayReference: paypal_order_id,
        merchantId: merchant_id,
        orderId: order_id,
        reason: 'PayPal capture completed but transaction status update failed',
        transactionId: transaction.id,
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

    if (!updatedTransaction) {
      // No error but no pending row: a concurrent request already completed it.
      // The payment is recorded — respond idempotently.
      return NextResponse.json({
        success: true,
        status: 'success',
        orderNumber:
          orderSnapshot.order_number || orderNumberFallback(order_id),
      });
    }

    // Advance the order to paid and run the post-capture side effects. This
    // also handles the cancelled-order clamp (F1) and serialized-inventory
    // confirmation (F5) before any notification/settlement, since funds are
    // already captured to the merchant's own PayPal account.
    return finalizePaypalCaptureOrder({
      supabase,
      merchantId: merchant_id,
      orderId: order_id,
      paypalOrderId: paypal_order_id,
      transaction,
      orderSnapshot,
    });
  } catch (error) {
    logger.error({
      message: 'PayPal capture order error',
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
