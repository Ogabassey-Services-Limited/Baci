import { type NextRequest, NextResponse } from 'next/server';
import { isValidUuid } from '@/lib/sanitize-core';
import { createServiceClient } from '@/lib/supabase/service';

// GET /api/storefront/orders/[id] - Public endpoint to fetch order for checkout resumption

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate UUID to prevent basic injection/scanning
    if (!isValidUuid(id)) {
      return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
    }

    // Use service client because user is likely a guest (not logged in)
    const supabase = createServiceClient();

    // 1. Fetch order details first (without join)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        subtotal,
        shipping_cost:shipping_fee,
        total,
        customer_name,
        customer_email,
        customer_phone,
        shipping_address,
        payment_status,
        shipping_status,
        payment_provider,
        merchant_id
      `)
      .eq('id', id)
      .single();

    if (orderError || !order) {
      console.error('Storefront order fetch error:', orderError);
      return NextResponse.json(
        { error: 'Order not found', details: orderError },
        { status: 404 }
      );
    }

    // 2. Fetch order items separately to avoid complex join issues or RLS edge cases
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('id, product_id, product_name:name, quantity, price')
      .eq('order_id', order.id);

    if (itemsError) {
      console.error('Storefront order items fetch error:', itemsError);
      // We can sort of proceed, or fail. Let's return empty items but log it.
    }

    // Combine result
    const result = {
      ...order,
      // Frontend expects short_id
      short_id: order.order_number,
      items: items || [],
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error(
      'Unexpected error in GET /api/storefront/orders/[id]:',
      error
    );
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
