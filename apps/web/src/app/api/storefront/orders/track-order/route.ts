import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAnonClient } from '@/lib/supabase/anon';

// Using direct Supabase client for unauthenticated order tracking.
// This endpoint allows customers to track orders using order_number + email
// without requiring authentication. The get_order_tracking RPC has RLS policies
// that verify email ownership before returning order data.

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

interface ShippingAddress {
  address?: string;
  city?: string;
  state?: string;
}

interface OrderItemRow {
  id: string;
  product_id: string;
  name: string;
  quantity: number;
  price: number;
  product_images?: unknown;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

// Type-guard helper to safely extract first image URL from unknown product_images
function extractFirstImageUrl(productImages: unknown): string | null {
  if (!Array.isArray(productImages) || productImages.length === 0) {
    return null;
  }

  const first = productImages[0];

  // Handle string URL
  if (typeof first === 'string') {
    return first;
  }

  // Handle object with url property
  if (
    first &&
    typeof first === 'object' &&
    'url' in first &&
    typeof first.url === 'string'
  ) {
    return first.url;
  }

  return null;
}

const trackOrderTokenSchema = z.object({
  token: z.string().min(1),
  merchant_slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/i),
});

const trackOrderEmailSchema = z
  .object({
    order_number: z.string().optional(),
    order_id: z.string().uuid().optional(),
    email: z.string().email(),
    merchant_slug: z
      .string()
      .min(1)
      .regex(/^[a-z0-9-]+$/i),
  })
  .refine((data) => data.order_number || data.order_id, {
    message: 'order_number or order_id is required',
  });

// GET - Track order by tracking token, or by order number/ID + email
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const trackingToken = searchParams.get('token');
    const orderNumber = searchParams.get('order_number');
    const orderId = searchParams.get('order_id');
    const email = searchParams.get('email');
    const merchantSlug =
      searchParams.get('merchant_slug') || searchParams.get('slug');

    // Validate input based on mode
    if (trackingToken) {
      const parsed = trackOrderTokenSchema.safeParse({
        token: trackingToken,
        merchant_slug: merchantSlug,
      });
      if (!parsed.success) {
        return NextResponse.json(
          {
            error: 'Invalid input',
            details: parsed.error.flatten().fieldErrors,
          },
          { status: 400 }
        );
      }
    } else {
      const parsed = trackOrderEmailSchema.safeParse({
        order_number: orderNumber,
        order_id: orderId,
        email,
        merchant_slug: merchantSlug,
      });
      if (!parsed.success) {
        return NextResponse.json(
          {
            error: 'Invalid input',
            details: parsed.error.flatten().fieldErrors,
          },
          { status: 400 }
        );
      }
    }

    const orderIdParam = orderId && isUuid(orderId) ? orderId : null;

    const supabase = createAnonClient();

    const { data: orders, error } = await supabase.rpc('get_order_tracking', {
      p_merchant_slug: merchantSlug,
      p_order_id: trackingToken ? null : orderIdParam,
      p_order_number: trackingToken ? null : orderNumber,
      p_email: trackingToken ? null : email,
      p_tracking_token: trackingToken || null,
    });

    const order = Array.isArray(orders) ? orders[0] : null;

    if (error || !order) {
      console.error('Track order error:', error?.code ?? 'NOT_FOUND');
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

    const shippingAddress = order.shipping_address as unknown as
      | ShippingAddress
      | string;

    return NextResponse.json({
      order: {
        id: order.id,
        order_number: order.order_number,
        status: order.shipping_status,
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
        address:
          typeof shippingAddress === 'object'
            ? shippingAddress.address
            : shippingAddress,
        city: typeof shippingAddress === 'object' ? shippingAddress.city : '',
        state: typeof shippingAddress === 'object' ? shippingAddress.state : '',
        country: 'Nigeria', // Simplified as it's typically Nigeria for this platform
      },
      items: (Array.isArray(order.items) ? order.items : []).map(
        (item: OrderItemRow) => ({
          id: item.id,
          product_id: item.product_id,
          product_name: item.name,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.price * item.quantity,
          product_image: extractFirstImageUrl(item.product_images),
        })
      ),
      timeline,
      shipping_tracking: shippingTracking,
      estimated_delivery: estimatedDelivery,
      merchant: {
        name: order.merchant_business_name,
        logo: order.merchant_logo_url,
        support_email: order.merchant_support_email,
        support_phone: order.merchant_support_phone || order.merchant_phone,
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
  shipping_status: string;
  payment_status: string;
  created_at: string;
  paid_at?: string;
  shipped_at?: string;
  delivered_at?: string;
  cancelled_at?: string;
}): TimelineEvent[] {
  const timeline: TimelineEvent[] = [];
  const status = order.shipping_status;

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
  if (['processing', 'shipped', 'delivered'].includes(status)) {
    timeline.push({
      status: status === 'processing' ? 'current' : 'completed',
      title: 'Processing',
      description: 'Your order is being prepared',
      timestamp: order.paid_at || order.created_at,
      icon: 'processing',
    });
  } else if (order.payment_status === 'paid' && status === 'pending') {
    timeline.push({
      status: 'pending',
      title: 'Processing',
      description: 'Your order will be prepared soon',
      timestamp: '',
      icon: 'processing',
    });
  }

  // Shipped
  if (['shipped', 'delivered'].includes(status)) {
    timeline.push({
      status: status === 'shipped' ? 'current' : 'completed',
      title: 'Shipped',
      description: 'Your order is on its way',
      timestamp: order.shipped_at || '',
      icon: 'shipped',
    });
  } else if (['processing'].includes(status)) {
    timeline.push({
      status: 'pending',
      title: 'Shipped',
      description: 'Your order will be shipped soon',
      timestamp: '',
      icon: 'shipped',
    });
  }

  // Delivered
  if (status === 'delivered') {
    timeline.push({
      status: 'completed',
      title: 'Delivered',
      description: 'Your order has been delivered',
      timestamp: order.delivered_at || '',
      icon: 'delivered',
    });
  } else if (['processing', 'shipped'].includes(status)) {
    timeline.push({
      status: 'pending',
      title: 'Delivered',
      description: 'Awaiting delivery',
      timestamp: '',
      icon: 'delivered',
    });
  }

  // Cancelled
  if (status === 'cancelled') {
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
  const encodedTracking = encodeURIComponent(trackingNumber);
  const providers: Record<string, string> = {
    gigl: `https://giglogistics.com/track/${encodedTracking}`,
    topship: `https://topship.africa/track/${encodedTracking}`,

    dhl: `https://www.dhl.com/en/express/tracking.html?AWB=${encodedTracking}`,
    fedex: `https://www.fedex.com/fedextrack/?trknbr=${encodedTracking}`,
    ups: `https://www.ups.com/track?tracknum=${encodedTracking}`,
  };

  return providers[provider.toLowerCase()] || '#';
}

function calculateEstimatedDelivery(order: {
  shipping_status: string;
  created_at: string;
  shipping_state?: string;
}): { min: string; max: string } | null {
  if (['delivered', 'cancelled'].includes(order.shipping_status)) {
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
  if (!email || !email.includes('@')) return '***';
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
