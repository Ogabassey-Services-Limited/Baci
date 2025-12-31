import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { notifyOrderStatusChange } from '@/lib/expo-push';
import { createClient } from '@/lib/supabase/server';

// GET /api/orders/[id] - Get a single order
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    // Get order (ensure it belongs to this merchant)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', id)
      .eq('merchant_id', merchant.id)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (error) {
    console.error('Unexpected error in GET /api/orders/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/orders/[id] - Update order status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const body = await request.json();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    // Verify order belongs to this merchant and get current status
    const { data: existingOrder, error: checkError } = await supabase
      .from('orders')
      .select(
        'id, order_number, shipping_status, payment_status, is_credit_order, customer_id'
      )
      .eq('id', id)
      .eq('merchant_id', merchant.id)
      .single();

    if (checkError || !existingOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Extract updatable fields
    const { payment_status, shipping_status, notes, shipping_address } = body;

    // Validate: Cannot move to 'processing' unless paid or is_credit_order
    if (
      shipping_status === 'processing' &&
      existingOrder.shipping_status === 'pending' &&
      existingOrder.payment_status !== 'paid' &&
      !existingOrder.is_credit_order
    ) {
      return NextResponse.json(
        {
          error:
            'Order must be paid before processing. Use the credit order flow to ship unpaid orders.',
          code: 'PAYMENT_REQUIRED',
        },
        { status: 400 }
      );
    }

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {};

    if (payment_status !== undefined) {
      updates.payment_status = payment_status;
    }
    if (shipping_status !== undefined) {
      updates.shipping_status = shipping_status;
    }
    if (notes !== undefined) {
      updates.notes = notes;
    }
    if (shipping_address !== undefined) {
      updates.shipping_address = shipping_address;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Update order
    const { data: order, error: updateError } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', id)
      .eq('merchant_id', merchant.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating order:', updateError);
      return NextResponse.json(
        { error: 'Failed to update order' },
        { status: 500 }
      );
    }

    // Send push notification if shipping status changed
    if (
      shipping_status !== undefined &&
      shipping_status !== existingOrder.shipping_status &&
      existingOrder.customer_id
    ) {
      // Get customer's user_id for push notification
      const { data: customer } = await supabase
        .from('customers')
        .select('user_id')
        .eq('id', existingOrder.customer_id)
        .single();

      if (customer?.user_id) {
        // Fire and forget - don't block the response
        notifyOrderStatusChange(
          customer.user_id,
          id,
          existingOrder.order_number,
          shipping_status
        ).catch((err) => {
          console.error('Failed to send order status push notification:', err);
        });
      }
    }

    return NextResponse.json({ order });
  } catch (error) {
    console.error('Unexpected error in PATCH /api/orders/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
