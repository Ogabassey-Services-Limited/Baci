import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/orders/update-payment-ref
 *
 * Updates an order with payment reference from external payment gateways.
 * Used by Credit Direct and other popup-based payment providers.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = z
      .object({
        orderId: z.string().uuid(),
        paymentRef: z.string().min(1),
        gateway: z.string().optional(),
        tracking_token: z.string().optional(),
      })
      .safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: parsed.error.flatten() },
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
      return NextResponse.json(
        { error: error.message || 'Failed to update order' },
        { status }
      );
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
