import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { computeOrderResidualAmount } from '@/lib/payments/order-residual-amount';
import {
  getPaypalCheckoutCredentials,
  readPaypalFeatureConfig,
} from '@/lib/payments/paypal-checkout-credentials';
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
const NON_PAYABLE_PAYMENT_STATUSES = new Set([
  'paid',
  'partially_paid',
  'bnpl_approved',
  'refunded',
]);

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
      // Reuse the stored PayPal order ONLY while it is still approvable, and
      // return its approval link so a cancel-then-retry can complete (F3). A
      // dead/consumed order falls through to a fresh order below.
      const approveUrl = await resolveReusablePaypalApproval(
        credentials,
        reusablePayPalOrderId,
        mode
      );
      if (approveUrl) {
        return NextResponse.json({
          id: reusablePayPalOrderId,
          approveUrl,
          reused: true,
        });
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
