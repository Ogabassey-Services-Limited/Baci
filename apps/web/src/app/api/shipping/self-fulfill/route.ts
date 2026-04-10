/**
 * Self-Fulfillment API
 * Mark an order as self-fulfilled with merchant's own shipping
 */

import { type NextRequest, NextResponse } from 'next/server';
import {
  authenticateApiRequest,
  getMerchantIdForApiUser,
} from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { isValidUuid } from '@/lib/sanitize-core';
import { SelfFulfillmentSchema } from '@/schemas/shipping';

// =============================================================================
// POST /api/shipping/self-fulfill - Mark order as self-fulfilled
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    // CSRF protection
    const { valid: csrfValid, response: csrfResponse } =
      await checkCsrfProtection(request);
    if (!csrfValid) {
      return (
        csrfResponse ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const merchantId = await getMerchantIdForApiUser(auth.supabase);
    if (!merchantId) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }
    const supabase = auth.supabase;
    const user = auth.user;

    // Fetch self_fulfillment_enabled for this merchant
    const { data: merchantData, error: merchantDataError } = await supabase
      .from('merchants')
      .select('self_fulfillment_enabled')
      .eq('id', merchantId)
      .single();

    if (merchantDataError || !merchantData) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Check if self-fulfillment is enabled for this merchant
    if (!merchantData.self_fulfillment_enabled) {
      return NextResponse.json(
        {
          error:
            'Self-fulfillment is not enabled for this merchant. Enable it in settings.',
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate request
    const parseResult = SelfFulfillmentSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    // Verify the order belongs to this merchant
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(
        'id, merchant_id, shipping_status, customer_name, customer_phone, shipping_address'
      )
      .eq('id', data.orderId)
      .eq('merchant_id', merchantId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Check if already shipped
    if (
      order.shipping_status === 'shipped' ||
      order.shipping_status === 'delivered'
    ) {
      return NextResponse.json(
        { error: 'Order has already been shipped' },
        { status: 400 }
      );
    }

    // Build self-fulfillment data
    const selfFulfillmentData = {
      trackingNumber: data.trackingNumber || null,
      dispatchPhone: data.dispatchPhone,
      carrierName: data.carrierName || 'Self-Delivery',
      dispatchNotes: data.dispatchNotes,
      fulfilledAt: new Date().toISOString(),
      fulfilledBy: user.id,
    };

    // Update order with self-fulfillment details
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        shipping_status: 'shipped',
        fulfillment_type: 'self',
        self_fulfillment_data: selfFulfillmentData,
        tracking_number: data.trackingNumber,
        shipping_provider: data.carrierName || 'Self-Delivery',
      })
      .eq('id', data.orderId)
      .eq('merchant_id', merchantId);

    if (updateError) {
      console.error('Error updating order:', updateError);
      return NextResponse.json(
        { error: 'Failed to update order' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Order marked as self-fulfilled',
        fulfillment: {
          orderId: data.orderId,
          trackingNumber: data.trackingNumber,
          dispatchPhone: data.dispatchPhone,
          carrierName: data.carrierName || 'Self-Delivery',
          customer: {
            name: order.customer_name,
            phone: order.customer_phone,
            address: order.shipping_address,
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error processing self-fulfillment:', error);
    return NextResponse.json(
      { error: 'Failed to process self-fulfillment' },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH /api/shipping/self-fulfill - Update self-fulfillment details
// =============================================================================

export async function PATCH(request: NextRequest) {
  try {
    // CSRF protection
    const { valid: csrfValid, response: csrfResponse } =
      await checkCsrfProtection(request);
    if (!csrfValid) {
      return (
        csrfResponse ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const merchantId = await getMerchantIdForApiUser(auth.supabase);
    if (!merchantId) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }
    const supabase = auth.supabase;

    const body = await request.json();
    const { orderId, ...updates } = body;

    if (!orderId || !isValidUuid(orderId)) {
      return NextResponse.json(
        { error: 'Valid order ID required' },
        { status: 400 }
      );
    }

    // Verify the order belongs to this merchant and is self-fulfilled
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, merchant_id, fulfillment_type, self_fulfillment_data')
      .eq('id', orderId)
      .eq('merchant_id', merchantId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.fulfillment_type !== 'self') {
      return NextResponse.json(
        { error: 'Order is not self-fulfilled' },
        { status: 400 }
      );
    }

    // Merge updates with existing data
    const updatedData = {
      ...order.self_fulfillment_data,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // Update order
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        self_fulfillment_data: updatedData,
        tracking_number:
          updates.trackingNumber || order.self_fulfillment_data?.trackingNumber,
      })
      .eq('id', orderId)
      .eq('merchant_id', merchantId);

    if (updateError) {
      console.error('Error updating self-fulfillment:', updateError);
      return NextResponse.json(
        { error: 'Failed to update order' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Self-fulfillment details updated',
      fulfillment: updatedData,
    });
  } catch (error) {
    console.error('Error updating self-fulfillment:', error);
    return NextResponse.json(
      { error: 'Failed to update self-fulfillment' },
      { status: 500 }
    );
  }
}
