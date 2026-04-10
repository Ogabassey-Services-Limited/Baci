import { type NextRequest, NextResponse } from 'next/server';
import {
  authenticateApiRequest,
  getMerchantIdForApiUser,
} from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  generateOrderDeliveredEmail,
  generateOrderDeliveredText,
} from '@/lib/email-templates';
import { logger } from '@/lib/logger';
import { ORDER_WITH_ITEMS_QUERY } from '@/lib/order-queries';
import { sendEmail } from '@/lib/zeptomail';
import { orderIdParamsSchema } from '@/schemas/orders';

/** Order item interface for email templates (2026 best practice) */
interface EmailOrderItem {
  name: string;
  quantity: number;
}

/**
 * POST /api/orders/[id]/delivered
 * Sends the "Order Delivered" email to the customer with optional Google rating CTA
 * Called when merchant marks order as delivered
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Authenticate request
    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const parsedParams = orderIdParamsSchema.safeParse(await params);
    if (!parsedParams.success) {
      return NextResponse.json(
        { error: 'Invalid order ID', code: 'INVALID_ORDER_ID' },
        { status: 400 }
      );
    }

    const { id } = parsedParams.data;
    console.log(`[OrderDelivered] Starting for order ${id}`);

    // Get merchant ID
    const merchantId = await getMerchantIdForApiUser(auth.supabase);
    if (!merchantId) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const supabase = auth.supabase;

    // ⚡ Bolt: PERFORMANCE: Execute independent database queries in parallel to prevent waterfall latency
    const [merchantResult, settingsResult, orderResult] = await Promise.all([
      // Fetch merchant details
      supabase
        .from('merchants')
        .select(
          'id, business_name, slug, support_email, email_sender_name, email, tax_identification_number, cac_rc_number'
        )
        .eq('id', merchantId)
        .single(),

      // Fetch merchant feature settings to get Google Place ID
      supabase
        .from('merchant_feature_settings')
        .select('google_place_id')
        .eq('merchant_id', merchantId)
        .single(),

      // Fetch order with items
      supabase
        .from('orders')
        .select(ORDER_WITH_ITEMS_QUERY)
        .eq('id', id)
        .eq('merchant_id', merchantId)
        .single(),
    ]);

    const { data: merchant, error: merchantError } = merchantResult;
    if (merchantError || !merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const { data: featureSettings, error: settingsError } = settingsResult;
    if (settingsError) {
      logger.error({
        message: 'Failed to fetch merchant feature settings',
        error: settingsError,
        merchantId,
        orderId: id,
      });
      return NextResponse.json(
        { error: 'Failed to load merchant settings' },
        { status: 500 }
      );
    }

    const { data: order, error: orderError } = orderResult;
    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Check if order is actually delivered
    if (order.shipping_status !== 'delivered') {
      return NextResponse.json(
        { error: 'Order must be marked as delivered first' },
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

    const deliveredData = {
      orderNumber: order.order_number || order.id.slice(0, 8).toUpperCase(),
      customerName: order.customer_name,
      items: emailItems,
      merchantName: merchant.business_name,
      merchantUrl,
      supportEmail: merchant.support_email,
      merchantTin: merchant.tax_identification_number ?? undefined,
      merchantRcNumber: merchant.cac_rc_number ?? undefined,
      googlePlaceId: featureSettings?.google_place_id || null,
    };

    const htmlContent = generateOrderDeliveredEmail(deliveredData);
    const textContent = generateOrderDeliveredText(deliveredData);

    const replyToEmail =
      merchant.support_email ||
      merchant.email ||
      `support@${merchant.slug}.${rootDomain}`;
    const senderName = merchant.email_sender_name
      ? `${merchant.email_sender_name}`
      : `${merchant.business_name}`;

    // Send email
    const emailResult = await sendEmail({
      to: order.customer_email,
      toName: order.customer_name,
      subject: `Your Order #${deliveredData.orderNumber} Has Been Delivered! 🎉`,
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
          trigger: 'order_delivered_notification',
        },
      },
    });

    if (!emailResult.success) {
      logger.error({
        message: 'Failed to send delivered email',
        error: emailResult.error,
      });
      return NextResponse.json(
        { error: 'Failed to send email', details: emailResult.error },
        { status: 500 }
      );
    }

    console.log(`[OrderDelivered] Email sent for order ${id}`);

    return NextResponse.json({
      success: true,
      message: 'Delivered notification sent',
      messageId: emailResult.messageId,
      hasGoogleRating: !!featureSettings?.google_place_id,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Error';
    console.error('Error in delivered notification:', error);
    logger.error({ message: 'Error sending delivered email', error });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
