
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

// GET /api/orders - Fetch orders for authenticated merchant
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get merchant record
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Get search params for filtering
    const { searchParams } = new URL(request.url);
    const paymentStatus = searchParams.get('payment_status');
    const shippingStatus = searchParams.get('shipping_status');
    const search = searchParams.get('search');

    // Build query
    let query = supabase
      .from('orders')
      .select('*')
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false });

    // Apply filters
    if (paymentStatus && paymentStatus !== 'all') {
      query = query.eq('payment_status', paymentStatus);
    }

    if (shippingStatus && shippingStatus !== 'all') {
      query = query.eq('shipping_status', shippingStatus);
    }

    // Search by customer name or order number
    if (search && search.trim()) {
      query = query.or(`customer_name.ilike.%${search}%,order_number.ilike.%${search}%`);
    }

    const { data: orders, error: ordersError } = await query;

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      return NextResponse.json(
        { error: 'Failed to fetch orders' },
        { status: 500 }
      );
    }

    return NextResponse.json({ orders: orders || [] });
  } catch (error) {
    console.error('Unexpected error in GET /api/orders:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/orders - Create new order from storefront
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const body = await request.json();

    const {
      merchant_id,
      customer_email,
      customer_name,
      customer_phone,
      items,
      subtotal,
      shipping_fee = 10.00, // Default shipping fee
      payment_method,
      payment_status = 'unpaid',
      shipping_status = 'pending',
      shipping_address,
      source = 'online_store',
      notes,
    } = body;

    // Validate required fields
    if (!merchant_id || !customer_email || !customer_name || !items || !subtotal) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Order must contain at least one item' },
        { status: 400 }
      );
    }

    // Calculate total
    const total = parseFloat(subtotal) + parseFloat(shipping_fee);

    // Create or get customer record
    let customer_id = null;
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id')
      .eq('merchant_id', merchant_id)
      .eq('email', customer_email)
      .single();

    if (existingCustomer) {
      customer_id = existingCustomer.id;
    } else {
      // Create new customer
      const nameParts = customer_name.split(' ');
      const first_name = nameParts[0] || '';
      const last_name = nameParts.slice(1).join(' ') || '';

      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert({
          merchant_id,
          email: customer_email,
          first_name,
          last_name,
          phone: customer_phone,
        })
        .select('id')
        .single();

      if (customerError) {
        console.error('Error creating customer:', customerError);
        // Continue without customer_id if customer creation fails
      } else {
        customer_id = newCustomer.id;
      }
    }

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        merchant_id,
        customer_id,
        customer_email,
        customer_name,
        customer_phone,
        items,
        subtotal,
        shipping_fee,
        total,
        payment_method,
        payment_status,
        shipping_status,
        shipping_address,
        source,
        notes,
      })
      .select()
      .single();

    if (orderError) {
      console.error('Error creating order:', orderError);
      return NextResponse.json(
        { error: 'Failed to create order', details: orderError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error in POST /api/orders:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
