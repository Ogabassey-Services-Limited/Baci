import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface TimelineEvent {
  status: string;
  title: string;
  description: string;
  timestamp: string;
  icon:
    | 'order'
    | 'payment'
    | 'processing'
    | 'shipped'
    | 'delivered'
    | 'cancelled';
}

// GET - Track order by order number or ID
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderNumber = searchParams.get('order_number');
    const orderId = searchParams.get('order_id');
    const email = searchParams.get('email');

    if (!orderNumber && !orderId) {
      return NextResponse.json(
        { error: 'order_number or order_id is required' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Build query
    let query = supabase.from('orders').select(`
        *,
        order_items (
          id,
          product_id,
          product_name,
          variant_name,
          quantity,
          unit_price,
          total_price,
          product_image
        ),
        merchants (
          id,
          business_name,
          slug,
          logo_url,
          support_email,
          support_phone
        )
      `);

    if (orderId) {
      query = query.eq('id', orderId);
    } else if (orderNumber) {
      query = query.eq('order_number', orderNumber);
    }

    // If email provided, verify it matches (for security)
    if (email) {
      query = query.eq('customer_email', email.toLowerCase());
    }

    const { data: order, error } = await query.single();

    if (error || !order) {
      return NextResponse.json(
        { error: 'Order not found. Please check your order number and email.' },
        { status: 404 }
      );
    }

    // Generate timeline events based on order status
    const timeline = generateTimeline(order);

    // Get shipping tracking if available
    let shippingTracking = null;
    if (order.tracking_number && order.shipping_provider) {
      shippingTracking = {
        provider: order.shipping_provider,
        tracking_number: order.tracking_number,
        tracking_url: getTrackingUrl(
          order.shipping_provider,
          order.tracking_number
        ),
      };
    }

    // Calculate estimated delivery
    const estimatedDelivery = calculateEstimatedDelivery(order);

    return NextResponse.json({
      order: {
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        payment_status: order.payment_status,
        created_at: order.created_at,
        updated_at: order.updated_at,
        subtotal: order.subtotal,
        shipping_cost: order.shipping_cost,
        discount_amount: order.discount_amount,
        total: order.total,
        currency: order.currency || 'NGN',
      },
      customer: {
        name: order.customer_name,
        email: maskEmail(order.customer_email),
        phone: maskPhone(order.customer_phone),
      },
      shipping_address: {
        address: order.shipping_address,
        city: order.shipping_city,
        state: order.shipping_state,
        country: order.shipping_country || 'Nigeria',
      },
      items: order.order_items,
      timeline,
      shipping_tracking: shippingTracking,
      estimated_delivery: estimatedDelivery,
      merchant: {
        name: order.merchants?.business_name,
        logo: order.merchants?.logo_url,
        support_email: order.merchants?.support_email,
        support_phone: order.merchants?.support_phone,
      },
    });
  } catch (error) {
    console.error('Error tracking order:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function generateTimeline(order: {
  status: string;
  payment_status: string;
  created_at: string;
  paid_at?: string;
  shipped_at?: string;
  delivered_at?: string;
  cancelled_at?: string;
}): TimelineEvent[] {
  const timeline: TimelineEvent[] = [];

  // Order placed
  timeline.push({
    status: 'completed',
    title: 'Order Placed',
    description: 'Your order has been received',
    timestamp: order.created_at,
    icon: 'order',
  });

  // Payment
  if (order.payment_status === 'paid') {
    timeline.push({
      status: 'completed',
      title: 'Payment Confirmed',
      description: 'Payment has been successfully processed',
      timestamp: order.paid_at || order.created_at,
      icon: 'payment',
    });
  } else if (order.payment_status === 'pending') {
    timeline.push({
      status: 'current',
      title: 'Awaiting Payment',
      description: 'We are waiting for payment confirmation',
      timestamp: order.created_at,
      icon: 'payment',
    });
  } else if (order.payment_status === 'failed') {
    timeline.push({
      status: 'failed',
      title: 'Payment Failed',
      description: 'There was an issue with your payment',
      timestamp: order.created_at,
      icon: 'payment',
    });
  }

  // Processing
  if (['processing', 'shipped', 'delivered'].includes(order.status)) {
    timeline.push({
      status: order.status === 'processing' ? 'current' : 'completed',
      title: 'Processing',
      description: 'Your order is being prepared',
      timestamp: order.paid_at || order.created_at,
      icon: 'processing',
    });
  } else if (order.payment_status === 'paid' && order.status === 'pending') {
    timeline.push({
      status: 'pending',
      title: 'Processing',
      description: 'Your order will be prepared soon',
      timestamp: '',
      icon: 'processing',
    });
  }

  // Shipped
  if (['shipped', 'delivered'].includes(order.status)) {
    timeline.push({
      status: order.status === 'shipped' ? 'current' : 'completed',
      title: 'Shipped',
      description: 'Your order is on its way',
      timestamp: order.shipped_at || '',
      icon: 'shipped',
    });
  } else if (['processing'].includes(order.status)) {
    timeline.push({
      status: 'pending',
      title: 'Shipped',
      description: 'Your order will be shipped soon',
      timestamp: '',
      icon: 'shipped',
    });
  }

  // Delivered
  if (order.status === 'delivered') {
    timeline.push({
      status: 'completed',
      title: 'Delivered',
      description: 'Your order has been delivered',
      timestamp: order.delivered_at || '',
      icon: 'delivered',
    });
  } else if (['processing', 'shipped'].includes(order.status)) {
    timeline.push({
      status: 'pending',
      title: 'Delivered',
      description: 'Awaiting delivery',
      timestamp: '',
      icon: 'delivered',
    });
  }

  // Cancelled
  if (order.status === 'cancelled') {
    timeline.push({
      status: 'failed',
      title: 'Cancelled',
      description: 'This order has been cancelled',
      timestamp: order.cancelled_at || '',
      icon: 'cancelled',
    });
  }

  return timeline;
}

function getTrackingUrl(provider: string, trackingNumber: string): string {
  const providers: Record<string, string> = {
    gigl: `https://giglogistics.com/track/${trackingNumber}`,
    topship: `https://topship.africa/track/${trackingNumber}`,
    shiip: `https://shiip.ng/track/${trackingNumber}`,
    dhl: `https://www.dhl.com/en/express/tracking.html?AWB=${trackingNumber}`,
    fedex: `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`,
    ups: `https://www.ups.com/track?tracknum=${trackingNumber}`,
  };

  return providers[provider.toLowerCase()] || '#';
}

function calculateEstimatedDelivery(order: {
  status: string;
  created_at: string;
  shipping_state?: string;
}): { min: string; max: string } | null {
  if (['delivered', 'cancelled'].includes(order.status)) {
    return null;
  }

  const orderDate = new Date(order.created_at);

  // Estimate based on location (Nigerian logistics)
  const isLagos = order.shipping_state?.toLowerCase().includes('lagos');
  const minDays = isLagos ? 1 : 3;
  const maxDays = isLagos ? 3 : 7;

  const minDate = new Date(orderDate);
  minDate.setDate(minDate.getDate() + minDays);

  const maxDate = new Date(orderDate);
  maxDate.setDate(maxDate.getDate() + maxDays);

  return {
    min: minDate.toISOString(),
    max: maxDate.toISOString(),
  };
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local.slice(0, 2)}***@${domain}`;
}

function maskPhone(phone?: string): string {
  if (!phone) return '';
  if (phone.length <= 4) return '****';
  return `${phone.slice(0, 4)}****${phone.slice(-2)}`;
}
