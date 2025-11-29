import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

/**
 * Order Tracking API (Storefront)
 *
 * GET - Track an order by order number and email
 *
 * Query params:
 * - orderNumber: string (required) - The order number or ID
 * - email: string (required) - Customer's email
 * - merchantId: string (optional) - The merchant's ID (for multi-tenant)
 */

interface OrderEvent {
  status: string;
  description: string;
  timestamp: string;
  location?: string;
}

interface ShippingDetails {
  provider?: string;
  tracking_number?: string;
  tracking_url?: string;
  estimated_delivery?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderNumber = searchParams.get('orderNumber');
    const email = searchParams.get('email');
    const merchantId = searchParams.get('merchantId');

    if (!orderNumber || !email) {
      return NextResponse.json(
        { error: 'orderNumber and email are required' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Build query to find order by number or ID
    let query = supabase
      .from('orders')
      .select(`
        id,
        order_number,
        status,
        total,
        subtotal,
        shipping_fee,
        discount_amount,
        currency,
        created_at,
        updated_at,
        shipping_address,
        billing_address,
        shipping_provider,
        tracking_number,
        tracking_url,
        estimated_delivery,
        fulfilled_at,
        delivered_at,
        cancelled_at,
        refunded_at,
        notes,
        order_items (
          id,
          product_id,
          product_name,
          variant_name,
          quantity,
          unit_price,
          total_price,
          image_url
        ),
        customers (
          id,
          name,
          email
        ),
        merchants (
          id,
          business_name,
          slug,
          phone,
          email
        )
      `)
      .or(`order_number.eq.${orderNumber},id.eq.${orderNumber}`);

    if (merchantId) {
      query = query.eq('merchant_id', merchantId);
    }

    const { data: order, error } = await query.single();

    if (error || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Verify email matches
    const customerEmail = (order.customers as { email?: string } | null)?.email;
    if (customerEmail?.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Build timeline of events
    const events: OrderEvent[] = [];

    // Order placed
    events.push({
      status: 'placed',
      description: 'Order placed',
      timestamp: order.created_at,
    });

    // Payment confirmed (assume shortly after order)
    if (order.status !== 'pending_payment' && order.status !== 'cancelled') {
      events.push({
        status: 'confirmed',
        description: 'Payment confirmed',
        timestamp: order.created_at, // Would be better with actual payment timestamp
      });
    }

    // Processing
    if (['processing', 'shipped', 'fulfilled', 'delivered'].includes(order.status)) {
      events.push({
        status: 'processing',
        description: 'Order is being prepared',
        timestamp: order.updated_at,
      });
    }

    // Shipped
    if (['shipped', 'fulfilled', 'delivered'].includes(order.status) || order.tracking_number) {
      const shippingProvider = order.shipping_provider || 'carrier';
      events.push({
        status: 'shipped',
        description: `Shipped via ${shippingProvider}`,
        timestamp: order.fulfilled_at || order.updated_at,
      });
    }

    // Out for delivery (if we have estimated delivery close to today)
    if (order.estimated_delivery) {
      const estimatedDate = new Date(order.estimated_delivery);
      const today = new Date();
      const daysDiff = Math.ceil((estimatedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff <= 1 && daysDiff >= 0 && order.status !== 'delivered') {
        events.push({
          status: 'out_for_delivery',
          description: 'Out for delivery',
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Delivered
    if (order.status === 'delivered' || order.delivered_at) {
      events.push({
        status: 'delivered',
        description: 'Delivered',
        timestamp: order.delivered_at || order.updated_at,
      });
    }

    // Cancelled
    if (order.status === 'cancelled') {
      events.push({
        status: 'cancelled',
        description: 'Order cancelled',
        timestamp: order.cancelled_at || order.updated_at,
      });
    }

    // Refunded
    if (order.status === 'refunded' || order.refunded_at) {
      events.push({
        status: 'refunded',
        description: 'Order refunded',
        timestamp: order.refunded_at || order.updated_at,
      });
    }

    // Sort events by timestamp
    events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Build shipping details
    const shipping: ShippingDetails = {};
    if (order.shipping_provider) shipping.provider = order.shipping_provider;
    if (order.tracking_number) shipping.tracking_number = order.tracking_number;
    if (order.tracking_url) shipping.tracking_url = order.tracking_url;
    if (order.estimated_delivery) shipping.estimated_delivery = order.estimated_delivery;

    // Get current status info
    const statusInfo = getStatusInfo(order.status);

    return NextResponse.json({
      order: {
        id: order.id,
        orderNumber: order.order_number || order.id,
        status: order.status,
        statusInfo,
        total: order.total,
        subtotal: order.subtotal,
        shippingFee: order.shipping_fee,
        discountAmount: order.discount_amount,
        currency: order.currency || 'NGN',
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        shippingAddress: order.shipping_address,
        billingAddress: order.billing_address,
        items: order.order_items,
        merchant: {
          name: (order.merchants as { business_name?: string } | null)?.business_name,
          slug: (order.merchants as { slug?: string } | null)?.slug,
          phone: (order.merchants as { phone?: string } | null)?.phone,
          email: (order.merchants as { email?: string } | null)?.email,
        },
      },
      shipping: Object.keys(shipping).length > 0 ? shipping : null,
      timeline: events,
      currentStatus: order.status,
    });
  } catch (error) {
    console.error('Order tracking error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Get human-readable status information
 */
function getStatusInfo(status: string): { label: string; description: string; color: string } {
  const statusMap: Record<string, { label: string; description: string; color: string }> = {
    pending_payment: {
      label: 'Awaiting Payment',
      description: 'Your order is awaiting payment confirmation.',
      color: 'yellow',
    },
    pending: {
      label: 'Order Received',
      description: 'Your order has been received and is being processed.',
      color: 'blue',
    },
    confirmed: {
      label: 'Confirmed',
      description: 'Your payment has been confirmed.',
      color: 'blue',
    },
    processing: {
      label: 'Processing',
      description: 'Your order is being prepared for shipping.',
      color: 'blue',
    },
    shipped: {
      label: 'Shipped',
      description: 'Your order has been shipped and is on its way.',
      color: 'purple',
    },
    fulfilled: {
      label: 'Fulfilled',
      description: 'Your order has been fulfilled and is in transit.',
      color: 'purple',
    },
    out_for_delivery: {
      label: 'Out for Delivery',
      description: 'Your order is out for delivery today.',
      color: 'purple',
    },
    delivered: {
      label: 'Delivered',
      description: 'Your order has been delivered.',
      color: 'green',
    },
    cancelled: {
      label: 'Cancelled',
      description: 'Your order has been cancelled.',
      color: 'red',
    },
    refunded: {
      label: 'Refunded',
      description: 'Your order has been refunded.',
      color: 'gray',
    },
  };

  return statusMap[status] || {
    label: status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' '),
    description: 'Your order is being processed.',
    color: 'gray',
  };
}
