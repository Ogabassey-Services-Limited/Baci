import { type NextRequest, NextResponse } from 'next/server';
import {
  authenticateApiRequest,
  getMerchantIdForApiUser,
} from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  generateOrderCancellationEmail,
  generateOrderCancellationText,
} from '@/lib/email-templates';
import { logger } from '@/lib/logger';
import { ORDER_WITH_ITEMS_QUERY } from '@/lib/order-queries';
import { processOrderCancellationRefund } from '@/lib/payments/order-cancellation-refund';
import { sendEmail } from '@/lib/zeptomail';

/** Order item interface for email templates (2026 best practice) */
interface EmailOrderItem {
  name: string;
  quantity: number;
  price: number;
}

/**
 * POST /api/orders/[id]/cancelled
 * Sends the "Order Cancelled" email to the customer
 * Called when merchant or customer cancels an order
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

    const { id } = await params;
    console.log(`[OrderCancelled] Starting for order ${id}`);

    // Parse optional body for cancellation details
    let cancellationReason: string | undefined;
    let cancelledBy: 'merchant' | 'customer' = 'merchant';

    try {
      const body = await request.json();
      cancellationReason = body.reason;
      cancelledBy = body.cancelled_by || 'merchant';
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

    // Check if order is actually cancelled
    if (order.shipping_status !== 'cancelled') {
      return NextResponse.json(
        { error: 'Order must be marked as cancelled first' },
        { status: 400 }
      );
    }

    // Full refund of the amount paid. The gateway dispatch, refund call, and
    // audit-row write live in processOrderCancellationRefund so this route stays
    // thin and the money path is unit-tested (paystack/paypal/korapay branches).
    const amountPaid = Number(order.amount_paid) || 0;
    const refundResult = await processOrderCancellationRefund(
      supabase,
      order,
      cancellationReason
    );
    const refundAmount = refundResult.amount;

    // Prepare email data
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
    const merchantUrl = `https://${merchant.slug}.${rootDomain}`;

    const emailItems =
      order.order_items?.map((item: EmailOrderItem) => ({
        name: item.name || 'Product',
        quantity: item.quantity || 1,
        price: item.price || 0,
      })) || [];

    const cancellationData = {
      orderNumber: order.order_number || order.id.slice(0, 8).toUpperCase(),
      customerName: order.customer_name,
      items: emailItems,
      totalAmount: Number(order.total) || 0,
      amountPaid,
      refundAmount,
      cancellationReason,
      cancelledBy,
      merchantName: merchant.business_name,
      merchantUrl,
      currency: order.currency || 'NGN',
      supportEmail: merchant.support_email,
      merchantTin: merchant.tax_identification_number ?? undefined,
      merchantRcNumber: merchant.cac_rc_number ?? undefined,
    };

    const htmlContent = generateOrderCancellationEmail(cancellationData);
    const textContent = generateOrderCancellationText(cancellationData);

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
      subject: `Order #${cancellationData.orderNumber} Has Been Cancelled`,
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
          trigger: 'order_cancelled_notification',
          cancelledBy,
        },
      },
    });

    if (!emailResult.success) {
      logger.error({
        message: 'Failed to send cancellation email',
        error: emailResult.error,
      });
      return NextResponse.json(
        { error: 'Failed to send email', details: emailResult.error },
        { status: 500 }
      );
    }

    console.log(`[OrderCancelled] Email sent for order ${id}`);

    return NextResponse.json({
      success: true,
      message: 'Cancellation notification sent',
      messageId: emailResult.messageId,
      refund: refundResult.attempted
        ? {
            attempted: true,
            success: refundResult.success,
            amount: refundAmount,
            refundId: refundResult.refundId,
            error: refundResult.error,
          }
        : {
            attempted: false,
            reason: 'No payment to refund',
          },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Error';
    console.error('Error in cancellation notification:', error);
    logger.error({ message: 'Error sending cancellation email', error });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
