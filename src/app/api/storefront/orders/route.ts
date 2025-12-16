import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Customer Orders API
 *
 * GET - Fetch orders for the authenticated customer
 */

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const merchantSlug = searchParams.get('merchantSlug');

    if (!merchantSlug) {
      return NextResponse.json(
        { error: 'Merchant slug is required' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get current auth session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id')
      .eq('slug', merchantSlug)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // Get customer record for this merchant
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('merchant_id', merchant.id)
      .eq('user_id', user.id)
      .single();

    if (customerError || !customer) {
      // Customer exists in auth but hasn't ordered from this merchant yet
      return NextResponse.json({ orders: [] });
    }

    // Fetch orders for this customer
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        created_at,
        total,
        subtotal,
        shipping_fee,
        payment_status,
        shipping_status,
        shipping_address,
        tracking_number,
        shipping_provider,
        order_items (
          id,
          name,
          quantity,
          price,
          has_assurance
        )
      `)
      .eq('customer_id', customer.id)
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false });

    if (ordersError) {
      console.error('Orders fetch error:', ordersError);
      return NextResponse.json(
        { error: 'Failed to fetch orders' },
        { status: 500 }
      );
    }

    // Transform to expected format
    const transformedOrders = orders.map((order) => ({
      ...order,
      items: order.order_items || [],
    }));

    return NextResponse.json({ orders: transformedOrders });
  } catch (error) {
    console.error('Orders API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
