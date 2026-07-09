import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import {
  getPaypalCheckoutCredentials,
  isPaypalAuthFailure,
  markPaypalCredentialInvalid,
  readPaypalFeatureConfig,
} from '@/lib/payments/paypal-checkout-credentials';
import {
  getReusablePayPalOrderId,
  resolvePaypalPresentment,
  validateSameOriginUrl,
} from '@/lib/payments/paypal-create-order-helpers';
import { recordByokFeeAccrual } from '@/lib/payments/record-byok-fee-accrual';
import { createOrder } from '@/lib/paypal';
import { createAdminClient } from '@/lib/supabase/admin';
import { paypalCreateOrderSchema } from '@/schemas/paypal-checkout';

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

    // FX fail-closed (Phase 2.5): NGN -> USD via the LIVE rate only; a missing
    // or invalid rate returns 503 and initializes nothing.
    const presentment = await resolvePaypalPresentment(
      orderCurrency,
      orderTotal
    );
    if (!presentment.ok) {
      // An unsupported settlement currency is a deterministic client error (the
      // store's currency will never be presentable), so it must NOT masquerade
      // as the transient FX outage (503) — surface it as a 400 the caller can
      // act on. A missing/invalid live NGN→USD rate stays a 503 retry.
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
      return NextResponse.json({ id: reusablePayPalOrderId, reused: true });
    }

    if (existingTransaction?.gateway_reference) {
      return NextResponse.json(
        {
          error:
            'Existing PayPal transaction does not match current order total',
          code: 'PAYPAL_TRANSACTION_MISMATCH',
        },
        { status: 409 }
      );
    }

    const paypalOrderResult = await createOrder(
      credentials.clientId,
      credentials.secretKey,
      presentmentAmount,
      presentmentCurrency,
      trackingToken,
      mode,
      { returnUrl, cancelUrl }
    );

    if (!paypalOrderResult.success) {
      // A 401 means the merchant's stored credentials are no longer valid:
      // disable them so availability drops immediately (Phase 2 item 1).
      if (isPaypalAuthFailure(paypalOrderResult.code)) {
        await markPaypalCredentialInvalid(
          merchant_id,
          environment,
          paypalOrderResult.error
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
        { error: paypalOrderResult.error, code: paypalOrderResult.code },
        { status: 500 }
      );
    }

    const paypalOrderId = paypalOrderResult.data.id;

    // Phantom-fee fix (Phase 2.6): platform fee is 0 and the merchant keeps the
    // full amount — money settles directly to the merchant's PayPal account.
    const { error: transactionError } = await supabase.rpc(
      'create_payment_transaction',
      {
        p_merchant_id: merchant_id,
        p_order_id: order_id,
        p_amount: orderTotal,
        p_currency: orderCurrency,
        p_gateway: 'paypal',
        p_reference: paypalOrderId,
        p_platform_fee: 0,
        p_merchant_amount: orderTotal,
        p_customer_email: customer_email,
        p_customer_name: null,
        p_session_id: null,
        p_metadata: {
          order_id,
          paypal_mode: mode,
          paypal_presentment_amount: presentmentAmount,
          paypal_presentment_currency: presentmentCurrency,
          paypal_fx_rate: fxRate,
        },
      }
    );

    if (transactionError) {
      logger.error({
        message: 'Failed to create pending PayPal transaction record',
        error: transactionError,
      });
      return NextResponse.json(
        { error: 'Failed to record transaction', code: 'DATABASE_ERROR' },
        { status: 500 }
      );
    }

    // Fee-accrual ledger row (fee waived); best-effort, never blocks checkout.
    await recordByokFeeAccrual({
      merchantId: merchant_id,
      orderId: order_id,
      transactionReference: paypalOrderId,
      provider: 'paypal',
      currency: orderCurrency,
      orderAmount: orderTotal,
    });

    return NextResponse.json({
      id: paypalOrderId,
      approveUrl: paypalOrderResult.data.approveUrl,
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
