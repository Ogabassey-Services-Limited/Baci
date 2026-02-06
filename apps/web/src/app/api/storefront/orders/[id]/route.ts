import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isValidUuid } from '@/lib/sanitize-core';
import { createAnonClient } from '@/lib/supabase/anon';
import { createClient } from '@/lib/supabase/server';

// GET /api/storefront/orders/[id] - Fetch order details for resuming checkout or BNPL flows

interface OrderItem {
  id: string;
  product_id: string;
  name: string;
  quantity: number;
  price: number;
  product_images?: string[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);

    const token =
      searchParams.get('token') ||
      searchParams.get('tracking_token') ||
      undefined;
    const email = searchParams.get('email') || undefined;
    const merchantSlug =
      searchParams.get('merchant_slug') ||
      searchParams.get('slug') ||
      undefined;

    const parsed = z
      .object({
        token: z.string().min(1).optional(),
        email: z.string().email().optional(),
        merchant_slug: z.string().min(1).optional(),
      })
      .safeParse({ token, email, merchant_slug: merchantSlug });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      if (!isValidUuid(id)) {
        return NextResponse.json(
          { error: 'Invalid order ID' },
          { status: 400 }
        );
      }

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select(
          `
            id,
            order_number,
            tracking_token,
            subtotal,
            shipping_fee,
            total,
            customer_name,
            customer_email,
            customer_phone,
            shipping_address,
            payment_status,
            shipping_status,
            payment_provider,
            merchant_id
          `
        )
        .eq('id', id)
        .single();

      if (orderError || !order) {
        console.error('Storefront order fetch error:', orderError);
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select('id, product_id, product_name:name, quantity, price')
        .eq('order_id', order.id);

      if (itemsError) {
        console.error('Storefront order items fetch error:', itemsError);
      }

      return NextResponse.json({
        ...order,
        shipping_cost: order.shipping_fee,
        short_id: order.order_number,
        items: items || [],
      });
    }

    if (!merchantSlug) {
      return NextResponse.json(
        { error: 'merchant_slug is required for public order lookup' },
        { status: 400 }
      );
    }

    if (!token && !email) {
      return NextResponse.json(
        { error: 'Tracking token or email is required' },
        { status: 400 }
      );
    }

    if (!token && !isValidUuid(id)) {
      return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
    }

    const anon = createAnonClient();
    const { data: orders, error } = await anon.rpc('get_order_tracking', {
      p_merchant_slug: merchantSlug,
      p_order_id: token ? null : id,
      p_order_number: null,
      p_email: token ? null : email,
      p_tracking_token: token || null,
    });

    const order = Array.isArray(orders) ? orders[0] : null;

    if (error || !order) {
      console.error('Storefront order fetch error:', error);
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const rawItems: OrderItem[] = Array.isArray(order.items) ? order.items : [];
    const items = rawItems.map((item: OrderItem) => ({
      id: item.id,
      product_id: item.product_id,
      product_name: item.name,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      product_images: item.product_images,
    }));

    return NextResponse.json({
      id: order.id,
      order_number: order.order_number,
      short_id: order.order_number,
      subtotal: order.subtotal,
      shipping_cost: order.shipping_cost ?? order.shipping_fee ?? 0,
      total: order.total,
      customer_name: order.customer_name,
      customer_email: order.customer_email,
      customer_phone: order.customer_phone,
      shipping_address: order.shipping_address,
      payment_status: order.payment_status,
      shipping_status: order.shipping_status,
      payment_provider: order.payment_provider,
      merchant_id: order.merchant_id,
      tracking_token: token || null,
      items,
    });
  } catch (error) {
    console.error(
      'Unexpected error in GET /api/storefront/orders/[id]:',
      error
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
