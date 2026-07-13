import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { loadPaypalCaptureContext } from '@/lib/payments/load-paypal-capture-context';
import type { PaypalCaptureContext } from '@/lib/payments/paypal-capture-execute';
import { getPaypalCheckoutCredentials } from '@/lib/payments/paypal-checkout-credentials';
import { resolveAndDispatchPaypalSettlement } from '@/lib/payments/paypal-settlement-funnel';
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

    // Pure state loader: scoping/mismatch guards + currentResidual. It no longer
    // decides the outcome — the resolver does.
    const load = await loadPaypalCaptureContext(supabase, {
      orderId: order_id,
      paypalOrderId: paypal_order_id,
      merchantId: merchant_id,
      customerEmail: customer_email,
    });
    if (!load.ok) {
      return NextResponse.json(load.body, { status: load.status });
    }

    // F6: capture with the order's ORIGINAL environment (locked in at
    // create-order time). PayPal Orders v2 IDs are environment-scoped.
    const mode = load.metadata?.paypal_mode === 'live' ? 'live' : 'sandbox';
    const environment = mode === 'live' ? 'live' : 'test';

    // Customer checkout is live-only (F10): refuse a sandbox capture.
    if (environment !== 'live') {
      return NextResponse.json(
        {
          error: 'PayPal sandbox mode is not allowed for customer checkout',
          code: 'PAYPAL_SANDBOX_NOT_ALLOWED',
        },
        { status: 400 }
      );
    }

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

    const ctx: PaypalCaptureContext = {
      supabase,
      merchantId: merchant_id,
      orderId: order_id,
      paypalOrderId: paypal_order_id,
      environment,
      mode,
      credentials,
      transaction: load.transaction,
      orderSnapshot: load.orderSnapshot,
      orderTotal: Number(load.orderSnapshot.total),
      lockedResidual: load.lockedResidual,
      currentResidual: load.currentResidual,
      presentmentAmount: load.presentmentAmount,
      presentmentCurrency: load.presentmentCurrency,
    };

    // One funnel for every settlement decision (capture-order / verify /
    // create-order): it derives the live PayPal status, resolves the outcome and
    // dispatches. This route is the only caller allowed to actually charge.
    return await resolveAndDispatchPaypalSettlement(ctx, 'capture');
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
