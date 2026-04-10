import { type NextRequest, NextResponse } from 'next/server';
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
interface EmailOrderItem {
  name: string;
  quantity: number;
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

    try {
      const body = await request.json();
      trackingNumber = body.tracking_number;
      courierName = body.courier_name;
      estimatedDelivery = body.estimated_delivery;
    } catch {
      // No body provided, that's fine
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

    // Check if order is actually shipped
    if (order.shipping_status !== 'shipped') {
      return NextResponse.json(
        { error: 'Order must be marked as shipped first' },
        { status: 400 }
      );
    }

    // Prepare email data
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
    const merchantUrl = `https://${merchant.slug}.${rootDomain}`;

    const emailItems =
      order.order_items?.map((item: EmailOrderItem) => ({
        name: item.name || 'Product',
        quantity: item.quantity || 1,
      })) || [];

    const shippedData = {
      orderNumber: order.order_number || order.id.slice(0, 8).toUpperCase(),
      customerName: order.customer_name,
      items: emailItems,
      shippingAddress: {
        address: order.shipping_address?.address || '',
        city: order.shipping_address?.city || '',
        state: order.shipping_address?.state || '',
        phone: order.customer_phone || '',
      },
      trackingNumber,
      courierName,
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
      to: order.customer_email,
      toName: order.customer_name,
      subject: `Your Order #${shippedData.orderNumber} Has Shipped! 🚚`,
      htmlContent,
      textContent,
      replyTo: replyToEmail,
      emailType: 'orders',
      fromName: senderName,
      auditContext: {
        merchantId,
        orderId: order.id,
        customerId: order.customer_id,
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
