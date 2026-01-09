import { type NextRequest, NextResponse } from 'next/server';
import {
  authenticateApiRequest,
  getAdminClient,
  getMerchantIdForApiUser,
} from '@/lib/api-auth';
import {
  generateOrderDeliveredEmail,
  generateOrderDeliveredText,
} from '@/lib/email-templates';
import { logger } from '@/lib/logger';
import { sendEmail } from '@/lib/zeptomail';

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
    const { id } = await params;
    console.log(`[OrderDelivered] Starting for order ${id}`);

    // Authenticate request
    const { user, error: authError } = await authenticateApiRequest(request);
    if (authError || !user) {
      return NextResponse.json(
        { error: authError || 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get merchant ID
    const merchantId = await getMerchantIdForApiUser(user.id);
    if (!merchantId) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const supabase = getAdminClient();

    // Fetch merchant details
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select(
        'id, business_name, slug, support_email, email_sender_name, email'
      )
      .eq('id', merchantId)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    // Fetch merchant feature settings to get Google Place ID
    const { data: featureSettings } = await supabase
      .from('merchant_feature_settings')
      .select('google_place_id')
      .eq('merchant_id', merchantId)
      .single();

    // Fetch order with items
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', id)
      .eq('merchant_id', merchant.id)
      .single();

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
