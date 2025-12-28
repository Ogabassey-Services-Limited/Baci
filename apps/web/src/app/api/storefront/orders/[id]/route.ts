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

    // Fetch order with items
    // We select specifically what's needed for the checkout UI to be safe
    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        id,
        short_id,
        subtotal,
        shipping_cost:shipping_fee,
        total,
        customer_name,
        customer_email,
        customer_phone,
        shipping_address,
        payment_status,
        shipping_status,
        merchant_id,
        items:order_items(
          id,
          product_id,
          product_name:name,
          quantity,
          price
        )
      `)
      .eq('id', id)
      .single();

    if (error || !order) {
      console.error('Storefront order fetch error:', error);
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json(order);
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
