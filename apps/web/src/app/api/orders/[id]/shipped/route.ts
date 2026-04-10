import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  authenticateApiRequest,
  getMerchantIdForApiUser,
} from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  generateOrderShippedEmail,
  generateOrderShippedText,
} from '@/lib/email-templates';
import { logger } from '@/lib/logger';
import { ORDER_WITH_ITEMS_QUERY } from '@/lib/order-queries';
import { sendEmail } from '@/lib/zeptomail';

/** Order item interface for email templates (2026 best practice) */
const optionalTrimmedStringSchema = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().optional()
);

const shippedEmailRequestBodySchema = z
  .object({
    tracking_number: optionalTrimmedStringSchema,
    courier_name: optionalTrimmedStringSchema,
    estimated_delivery: optionalTrimmedStringSchema,
  })
  .strict();

const shippedOrderSchema = z.object({
  id: z.string().min(1),
  customer_id: z.string().nullable().optional(),
  order_number: z.string().nullable(),
  customer_name: z.string().min(1),
  customer_email: z.string().email(),
  customer_phone: z.string().nullable(),
  shipping_status: z.string().min(1),
  shipping_provider: z.string().nullable(),
  tracking_number: z.string().nullable(),
  tracking_token: z.string().nullable(),
  shipping_address: z
    .object({
      address: z.string().nullable().optional(),
      city: z.string().nullable().optional(),
      state: z.string().nullable().optional(),
    })
    .nullable(),
  order_items: z
    .array(
      z.object({
        name: z.string().nullable(),
        quantity: z.number().nullable(),
      })
    )
    .nullable(),
});

type ShippedOrderRecord = z.infer<typeof shippedOrderSchema>;

function buildTrackingUrl(
  rootDomain: string,
  merchantSlug: string,
  order: ShippedOrderRecord,
  trackingNumber?: string
): string | undefined {
  if (order.tracking_token) {
    return `https://${merchantSlug}.${rootDomain}/track-order?token=${encodeURIComponent(order.tracking_token)}`;
  }

  if (trackingNumber) {
    return `https://${rootDomain}/track/${encodeURIComponent(trackingNumber)}`;
  }

  return undefined;
}

/**
 * POST /api/orders/[id]/shipped
 * Sends the "Order Shipped" email to the customer
 * Called when merchant marks order as shipped
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { valid, response } = await checkCsrfProtection(request);
    if (!valid) return response as NextResponse;

    const { id } = await params;
    logger.info({ message: 'OrderShipped starting', orderId: id });

    // Optional body for tracking info
    let trackingNumber: string | undefined;
    let courierName: string | undefined;
    let estimatedDelivery: string | undefined;

    const rawBody = await request.text();
    if (rawBody.trim().length > 0) {
      let body: unknown;
      try {
        body = JSON.parse(rawBody);
      } catch {
        return NextResponse.json(
          { error: 'Malformed JSON body' },
          { status: 400 }
        );
      }
      const parsedBody = shippedEmailRequestBodySchema.safeParse(body);
      if (!parsedBody.success) {
        return NextResponse.json(
          {
            error: 'Invalid request body',
            details: parsedBody.error.flatten(),
          },
          { status: 400 }
        );
      }
      trackingNumber = parsedBody.data.tracking_number;
      courierName = parsedBody.data.courier_name;
      estimatedDelivery = parsedBody.data.estimated_delivery;
    }

    // Authenticate request
    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get merchant ID
    const merchantId = await getMerchantIdForApiUser(auth.supabase);
    if (!merchantId) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const supabase = auth.supabase;

    // Fetch merchant details
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select(
        'id, business_name, slug, support_email, email_sender_name, email, tax_identification_number, cac_rc_number'
      )
      .eq('id', merchantId)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Fetch order with items
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(ORDER_WITH_ITEMS_QUERY)
      .eq('id', id)
      .eq('merchant_id', merchant.id)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    const parsedOrder = shippedOrderSchema.safeParse(order);
    if (!parsedOrder.success) {
      logger.error({
        message: 'Invalid order payload for shipped email',
        orderId: id,
        error: parsedOrder.error.flatten(),
      });
      return NextResponse.json(
        { error: 'Invalid order payload' },
        { status: 500 }
      );
    }
    const shippedOrder: ShippedOrderRecord = parsedOrder.data;

    // Check if order is actually shipped
    if (shippedOrder.shipping_status !== 'shipped') {
      return NextResponse.json(
        { error: 'Order must be marked as shipped first' },
        { status: 400 }
      );
    }

    // Prepare email data
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
    const merchantUrl = `https://${merchant.slug}.${rootDomain}`;
    const resolvedTrackingNumber =
      trackingNumber || shippedOrder.tracking_number || undefined;
    const resolvedCourierName =
      courierName || shippedOrder.shipping_provider || undefined;
    const trackingUrl = buildTrackingUrl(
      rootDomain,
      merchant.slug,
      shippedOrder,
      resolvedTrackingNumber
    );

    const emailItems =
      shippedOrder.order_items?.map((item) => ({
        name: item.name || 'Product',
        quantity: item.quantity || 1,
      })) || [];

    const shippedData = {
      orderNumber:
        shippedOrder.order_number || shippedOrder.id.slice(0, 8).toUpperCase(),
      customerName: shippedOrder.customer_name,
      items: emailItems,
      shippingAddress: {
        address: shippedOrder.shipping_address?.address || '',
        city: shippedOrder.shipping_address?.city || '',
        state: shippedOrder.shipping_address?.state || '',
        phone: shippedOrder.customer_phone || '',
      },
      trackingNumber: resolvedTrackingNumber,
      trackingUrl,
      courierName: resolvedCourierName,
      estimatedDelivery,
      merchantName: merchant.business_name,
      merchantUrl,
      supportEmail: merchant.support_email,
      merchantTin: merchant.tax_identification_number ?? undefined,
      merchantRcNumber: merchant.cac_rc_number ?? undefined,
    };

    const htmlContent = generateOrderShippedEmail(shippedData);
    const textContent = generateOrderShippedText(shippedData);

    const replyToEmail =
      merchant.support_email ||
      merchant.email ||
      `support@${merchant.slug}.${rootDomain}`;
    const senderName = merchant.email_sender_name
      ? `${merchant.email_sender_name} Shipping`
      : `${merchant.business_name} Shipping`;

    // Send email
    const emailResult = await sendEmail({
      to: shippedOrder.customer_email,
      toName: shippedOrder.customer_name,
      subject: `Your Order #${shippedData.orderNumber} Has Shipped! 🚚`,
      htmlContent,
      textContent,
      replyTo: replyToEmail,
      emailType: 'orders',
      fromName: senderName,
      auditContext: {
        merchantId,
        orderId: shippedOrder.id,
        customerId: shippedOrder.customer_id,
        metadata: {
          trigger: 'order_shipped_notification',
        },
      },
    });

    if (!emailResult.success) {
      logger.error({
        message: 'Failed to send shipped email',
        error: emailResult.error,
      });
      return NextResponse.json(
        { error: 'Failed to send email', details: emailResult.error },
        { status: 500 }
      );
    }

    logger.info({ message: 'OrderShipped email sent', orderId: id });

    return NextResponse.json({
      success: true,
      message: 'Shipped notification sent',
      messageId: emailResult.messageId,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Error';
    logger.error({ message: 'Error sending shipped email', error });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
