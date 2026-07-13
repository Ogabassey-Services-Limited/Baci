import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { NON_PAYABLE_PAYMENT_STATUSES } from '@/lib/payments/non-payable-payment-statuses';
import { computeOrderResidualAmount } from '@/lib/payments/order-residual-amount';
import {
  getPaypalCheckoutCredentials,
  readPaypalFeatureConfig,
} from '@/lib/payments/paypal-checkout-credentials';
import { reconcileCompletedPaypalOrderForCreate } from '@/lib/payments/paypal-completed-order-reconcile';
import {
  getReusablePayPalOrderId,
  resolvePaypalPresentment,
  resolveReusablePaypalApproval,
  validateSameOriginUrl,
} from '@/lib/payments/paypal-create-order-helpers';
import { createAndPersistPaypalOrder } from '@/lib/payments/paypal-create-order-persistence';
import { createAdminClient } from '@/lib/supabase/admin';
import { paypalCreateOrderSchema } from '@/schemas/paypal-checkout';

// Payment statuses that mean an order has already been settled (fully or in
// part) or is otherwise no longer chargeable. Starting a fresh PayPal checkout
// for any of these would let a second approval+capture run against money that is
// already accounted for (F11).
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = paypalCreateOrderSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid input parameters', details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { order_id, customer_email, merchant_id, return_url, cancel_url } =
      result.data;

    let returnUrl: string | undefined;
    let cancelUrl: string | undefined;
    try {
      returnUrl = validateSameOriginUrl(return_url, request.nextUrl.origin);
      cancelUrl = validateSameOriginUrl(cancel_url, request.nextUrl.origin);
    } catch {
      return NextResponse.json(
        {
          error: 'PayPal return and cancel URLs must match checkout origin',
          code: 'INVALID_RETURN_URL',
        },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: snapshotRows, error: snapshotError } = await supabase.rpc(
      'get_order_payment_snapshot',
      { p_order_id: order_id, p_email: customer_email }
    );

    const orderSnapshot = Array.isArray(snapshotRows) ? snapshotRows[0] : null;

    if (snapshotError || !orderSnapshot) {
      return NextResponse.json(
        {
          error: 'Order not found or customer details mismatch',
          code: 'ORDER_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    if (orderSnapshot.merchant_id !== merchant_id) {
      return NextResponse.json(
        {
          error: 'Merchant mismatch for this order',
          code: 'MERCHANT_MISMATCH',
        },
        { status: 403 }
      );
    }

    // A cancelled order is never payable — reject before creating a PayPal order
    // so a buyer cannot approve+capture funds for an order they already
    // cancelled (mirrors initialize + credit-direct/sign).
    if (orderSnapshot.shipping_status === 'cancelled') {
      return NextResponse.json(
        {
          error: 'This order has been cancelled and can no longer be paid',
          code: 'ORDER_NOT_PAYABLE',
        },
        { status: 409 }
      );
    }

    // An already-settled order must not start another PayPal checkout — without
    // this a second approval+capture could run against an order that is already
    // paid/partially paid/refunded (F11). Reject before minting any PayPal order
    // or writing a transaction. Complements the cancelled-order guard above.
    if (
      NON_PAYABLE_PAYMENT_STATUSES.has(String(orderSnapshot.payment_status))
    ) {
      return NextResponse.json(
        {
          error: 'This order can no longer be paid',
          code: 'ORDER_NOT_PAYABLE',
        },
        { status: 409 }
      );
    }

    const orderTotal = Number(orderSnapshot.total);
    if (orderSnapshot.total == null || !(orderTotal > 0)) {
      return NextResponse.json(
        { error: 'Invalid order total', code: 'INVALID_AMOUNT' },
        { status: 400 }
      );
    }

    // F-263: a prior PayPal capture may have COMPLETED while its order
    // finalization failed/rolled back, leaving a `completed` transaction on an
    // order that still reads as payable (the payment_status guard above only
    // catches settled orders). Minting a fresh PayPal order here would hand the
    // buyer a SECOND approval+capture for money already collected. Look for that
    // completed transaction BEFORE minting/reusing: if one exists, reconcile the
    // order to paid (idempotent via the finalize claim CAS) instead of charging
    // again, then block the retry with 409 so the client stops starting new
    // checkouts. Complements the pending-transaction reuse guard (H1/H11) below,
    // which only covers the still-open PayPal order.
    const { data: completedPaypalTxn, error: completedTxnError } =
      await supabase
        .from('transactions')
        .select('id, amount, gateway_reference')
        .eq('order_id', order_id)
        .eq('merchant_id', merchant_id)
        .eq('gateway', 'paypal')
        .eq('status', 'completed')
        .maybeSingle();

    if (completedTxnError) {
      logger.error({
        message: 'Failed to check completed PayPal transaction',
        error: completedTxnError,
      });
      return NextResponse.json(
        {
          error: 'Failed to inspect transaction state',
          code: 'DATABASE_ERROR',
        },
        { status: 500 }
      );
    }

    if (completedPaypalTxn?.gateway_reference) {
      // Route through the SAME settlement funnel as capture-order/verify — one
      // resolver, one writer — so this guard inherits residual freshness, the
      // settler verdict and post-capture refunds instead of re-deriving them.
      // Then block the retry.
      await reconcileCompletedPaypalOrderForCreate(supabase, {
        merchantId: merchant_id,
        orderId: order_id,
        paypalOrderId: completedPaypalTxn.gateway_reference,
      });

      return NextResponse.json(
        {
          error:
            'This order has already been captured by PayPal and is being finalized',
          code: 'ORDER_ALREADY_CAPTURED',
        },
        { status: 409 }
      );
    }

    // Non-secret PayPal config stays in merchant_feature_settings (Phase 2.2).
    const { data: featureSettings, error: featuresError } = await supabase
      .from('merchant_feature_settings')
      .select('custom_settings')
      .eq('merchant_id', merchant_id)
      .single();

    if (featuresError || !featureSettings) {
      return NextResponse.json(
        {
          error: 'Merchant payment settings not configured',
          code: 'SETTINGS_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    const { enabled, mode, environment } = readPaypalFeatureConfig(
      featureSettings.custom_settings as Record<string, unknown> | null
    );

    if (!enabled) {
      return NextResponse.json(
        {
          error: 'PayPal is not enabled for this store',
          code: 'PAYPAL_NOT_CONFIGURED',
        },
        { status: 400 }
      );
    }

    // Sandbox is reserved for the settings-page validate-on-save connection test
    // ONLY. A customer checkout must run against live PayPal, or a merchant left
    // on paypal_mode='sandbox' would take real orders marked paid with no funds
    // moved (F10). Fail closed before minting any PayPal order.
    if (environment !== 'live') {
      return NextResponse.json(
        {
          error: 'PayPal sandbox mode is not allowed for customer checkout',
          code: 'PAYPAL_SANDBOX_NOT_ALLOWED',
        },
        { status: 400 }
      );
    }

    // Credentials come only from the encrypted vault (Phase 2.2). Fail closed.
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

    const trackingToken =
      typeof orderSnapshot.tracking_token === 'string'
        ? orderSnapshot.tracking_token
        : order_id.substring(0, 8);

    const orderCurrency =
      typeof orderSnapshot.currency === 'string'
        ? orderSnapshot.currency.trim().toUpperCase()
        : 'USD';

    // Charge only the outstanding balance: wallet credit + redeemed savings are
    // settled Baci-side, so PayPal presents the residual (not the full total) or
    // a mixed-tender buyer is overcharged (mirrors initialize).
    const residual = await computeOrderResidualAmount(supabase, {
      orderId: order_id,
      merchantId: merchant_id,
      orderTotal,
    });
    if (!residual.ok) {
      const savingsFailed = residual.reason === 'savings_lookup_failed';
      return NextResponse.json(
        {
          error: savingsFailed
            ? 'Unable to verify order savings amount'
            : 'Unable to verify order payment amount',
          code: savingsFailed
            ? 'ORDER_SAVINGS_LOOKUP_FAILED'
            : 'ORDER_AMOUNT_LOOKUP_FAILED',
        },
        { status: 500 }
      );
    }
    const { residualAmount } = residual;
    if (!(residualAmount > 0)) {
      return NextResponse.json(
        {
          error: 'No payable amount remains for this order',
          code: 'NO_PAYABLE_AMOUNT',
        },
        { status: 400 }
      );
    }

    // FX fail-closed (Phase 2.5): NGN -> USD via the LIVE rate only; a missing
    // or invalid rate returns 503 and initializes nothing.
    const presentment = await resolvePaypalPresentment(
      orderCurrency,
      residualAmount
    );
    if (!presentment.ok) {
      // An unsupported settlement currency is a deterministic client error (400)
      // and must NOT masquerade as the transient FX outage (503).
      if (presentment.reason === 'unsupported_currency') {
        return NextResponse.json(
          {
            error: 'This order currency is not supported by PayPal',
            code: 'PAYPAL_UNSUPPORTED_CURRENCY',
          },
          { status: 400 }
        );
      }
      return NextResponse.json(
        {
          error: 'Live exchange rate unavailable, please try again',
          code: 'FX_RATE_UNAVAILABLE',
        },
        { status: 503 }
      );
    }
    const { presentmentAmount, presentmentCurrency, fxRate } = presentment;

    const { data: existingTransaction, error: existingTransactionError } =
      await supabase
        .from('transactions')
        .select('gateway_reference, metadata')
        .eq('order_id', order_id)
        .eq('merchant_id', merchant_id)
        .eq('gateway', 'paypal')
        .eq('status', 'pending')
        .maybeSingle();

    if (existingTransactionError) {
      logger.error({
        message: 'Failed to check existing PayPal transaction',
        error: existingTransactionError,
      });
      return NextResponse.json(
        {
          error: 'Failed to inspect transaction state',
          code: 'DATABASE_ERROR',
        },
        { status: 500 }
      );
    }

    const reusablePayPalOrderId = getReusablePayPalOrderId(
      existingTransaction,
      presentmentAmount,
      presentmentCurrency
    );
    if (reusablePayPalOrderId) {
      // Reuse the stored PayPal order while it is still capturable (CREATED /
      // PAYER_ACTION_REQUIRED / APPROVED), returning its approval link so a
      // cancel-then-retry can complete the SAME order (F3/F-158). ONLY a
      // COMPLETED order — PayPal already captured the funds — blocks with a 409
      // the checkout can surface (H1): minting a fresh order would hand the buyer
      // a second approval link for money already collected. A dead
      // (voided/expired) order, or a capturable one with no approval link, falls
      // through to a fresh mint below (the prior order was never captured).
      const reuse = await resolveReusablePaypalApproval(
        credentials,
        reusablePayPalOrderId,
        mode
      );
      if (reuse.outcome === 'reuse') {
        return NextResponse.json({
          id: reusablePayPalOrderId,
          approveUrl: reuse.approveUrl,
          reused: true,
        });
      }
      if (reuse.outcome === 'lookup_failed') {
        // We could not establish whether the stored PayPal order was already
        // captured. Minting a replacement could double-charge, so fail closed and
        // let the buyer retry once PayPal is reachable again.
        logger.warn({
          message:
            'PayPal create-order: reusable-order lookup failed; refusing to mint a replacement',
          merchantId: merchant_id,
          orderId: order_id,
          paypalOrderId: reusablePayPalOrderId,
          reason: reuse.reason,
        });
        return NextResponse.json(
          {
            error:
              'Could not verify your existing PayPal checkout. Please try again in a moment.',
            code: 'PAYPAL_ORDER_LOOKUP_FAILED',
          },
          { status: 503 }
        );
      }
      if (reuse.outcome === 'already_captured') {
        // F-393: the reuse branch used to 409 WITHOUT finalizing — money was
        // captured at PayPal but the order stayed unpaid + unsettled. Route it
        // through the SAME settlement funnel as the capture route BEFORE blocking
        // the retry, so it inherits residual freshness and post-capture refunds.
        await reconcileCompletedPaypalOrderForCreate(supabase, {
          merchantId: merchant_id,
          orderId: order_id,
          paypalOrderId: reusablePayPalOrderId,
        });

        return NextResponse.json(
          {
            error:
              'This order has already been captured by PayPal and is being finalized',
            code: 'ORDER_ALREADY_CAPTURED',
          },
          { status: 409 }
        );
      }
    }

    const created = await createAndPersistPaypalOrder(supabase, {
      credentials,
      environment,
      merchantId: merchant_id,
      orderId: order_id,
      customerEmail: customer_email,
      orderCurrency,
      residualAmount,
      presentmentAmount,
      presentmentCurrency,
      fxRate,
      trackingToken,
      mode,
      returnUrl,
      cancelUrl,
      existingTransaction,
    });

    if (!created.ok) {
      return NextResponse.json(created.body, { status: created.status });
    }

    return NextResponse.json({
      id: created.id,
      approveUrl: created.approveUrl,
    });
  } catch (error) {
    logger.error({
      message: 'PayPal create order error',
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
