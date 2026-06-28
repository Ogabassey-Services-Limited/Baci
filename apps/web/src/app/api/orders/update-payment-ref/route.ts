import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/orders/update-payment-ref
 *
 * Updates an order with payment reference from external payment gateways.
 * Used by Credit Direct and other popup-based payment providers.
 *
 * Auth exemption: No auth check here — the `set_order_payment_ref` RPC
 * is SECURITY DEFINER and validates order ownership internally.
 *
 * CSRF exemption: Called from popup-based payment flows (Credit Direct)
 * where the frontend initiates payment after order creation. Abuse is
 * mitigated by rate limiting in proxy.ts and the RPC's internal validation.
 */
export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const parsed = z
      .object({
        orderId: z.uuid(),
        paymentRef: z.string().min(1),
        gateway: z.string().optional(),
        tracking_token: z.string().optional(),
      })
      .safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: z.flattenError(parsed.error),
        },
        { status: 400 }
      );
    }

    const { orderId, paymentRef, gateway, tracking_token } = parsed.data;

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data, error } = await supabase.rpc('set_order_payment_ref', {
      p_order_id: orderId,
      p_payment_ref: paymentRef,
      p_gateway: gateway || null,
      p_tracking_token: tracking_token || null,
    });

    if (error) {
      console.error('Failed to update order payment ref:', error);
      const status =
        error.code === 'PGRST116' || error.message === 'order_not_found'
          ? 404
          : error.message === 'unauthorized'
            ? 403
            : 500;
      // Only expose known error messages; mask internal errors on 500
      const clientMessage =
        status === 404
          ? 'Order not found'
          : status === 403
            ? 'Unauthorized'
            : 'Failed to update order';
      return NextResponse.json({ error: clientMessage }, { status });
    }

    return NextResponse.json({ success: Boolean(data) });
  } catch (error) {
    console.error('Update payment ref error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
