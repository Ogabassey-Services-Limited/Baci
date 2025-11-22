
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { sanitizeSearchQuery, sanitizeLikePattern, isValidUuid } from '@/lib/sanitize';

// GET /api/orders - Fetch orders for authenticated merchant
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('API: Auth error or no user', authError);
      return NextResponse.json(
        { error: 'Unauthorized: You must be logged in to fetch orders.' },
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
      console.error('API: Merchant not found for user', { userId: user.id, merchantError });
      return NextResponse.json(
        { error: 'Merchant not found for the authenticated user.' },
        { status: 404 }
      );
    }

    // Get search params for filtering
    const { searchParams } = new URL(request.url);
    const paymentStatus = searchParams.get('payment_status');
    const shippingStatus = searchParams.get('shipping_status');
    const searchRaw = searchParams.get('search');

    // Sanitize search input
    const search = searchRaw ? sanitizeSearchQuery(searchRaw) : null;

    // Build query
    let query = supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false });

    // Apply filters
    if (paymentStatus && paymentStatus !== 'all') {
      query = query.eq('payment_status', paymentStatus);
    }

    if (shippingStatus && shippingStatus !== 'all') {
      query = query.eq('shipping_status', shippingStatus);
    }

    // Search by customer name or order number (with sanitized input)
    if (search && search.trim()) {
      const sanitizedPattern = sanitizeLikePattern(search);
      query = query.or(`customer_name.ilike.%${sanitizedPattern}%,order_number.ilike.%${sanitizedPattern}%`);
    }

    const { data: orders, error: ordersError } = await query;

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      return NextResponse.json(
        { error: 'Failed to fetch orders from the database.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ orders: orders || [] });
  } catch (error) {
    console.error('Unexpected error in GET /api/orders:', error);
    return NextResponse.json(
      { error: 'An internal server error occurred.' },
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

    // Validate merchant_id is a valid UUID
    if (!merchant_id || !isValidUuid(merchant_id)) {
      return NextResponse.json(
        { error: 'Invalid merchant ID' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!customer_email || !customer_name || !items || subtotal === undefined) {
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
        // items removed as column does not exist
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

    // Insert order items into the new normalized table
    if (order) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const orderItems = items.map((item: any) => ({
        order_id: order.id,
        product_id: item.product_id || item.productId || item.id, // Handle various potential input formats
        name: item.name || item.productName || 'Unknown Product',
        quantity: item.quantity || 1,
        price: item.price || 0,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        console.error('Error creating order items:', itemsError);
        // Note: In a production environment, we should use a transaction or rollback the order creation.
      } else {
        // Update product stock atomically using RPC function
        for (const item of orderItems) {
          if (item.product_id) {
            // Use atomic stock decrement function to prevent race conditions
            const { data: stockResult, error: stockError } = await supabase
              .rpc('decrement_product_stock', {
                product_id_param: item.product_id,
                quantity_param: item.quantity,
              });

            if (stockError) {
              console.error('Error updating stock:', stockError);
              // Continue processing other items even if one fails
            } else if (stockResult && stockResult.length > 0) {
              const result = stockResult[0];
              if (!result.success) {
                console.warn(`Stock update failed for product ${item.product_id}: ${result.message}`);
                // In production, you might want to handle insufficient stock differently
                // For now, we log and continue
              }
            }
          }
        }
      }
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
