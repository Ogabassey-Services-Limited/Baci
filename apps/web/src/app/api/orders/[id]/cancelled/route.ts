import { type NextRequest, NextResponse } from 'next/server';
import {
  authenticateApiRequest,
  getAdminClient,
  getMerchantIdForApiUser,
} from '@/lib/api-auth';
import {
  generateOrderCancellationEmail,
  generateOrderCancellationText,
} from '@/lib/email-templates';
import { logger } from '@/lib/logger';
import { initiateRefund as initiatePaystackRefund } from '@/lib/paystack';
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

    // Check if order is actually cancelled
    if (order.shipping_status !== 'cancelled') {
      return NextResponse.json(
        { error: 'Order must be marked as cancelled first' },
        { status: 400 }
      );
    }

    // Calculate refund amount
    const amountPaid = Number(order.amount_paid) || 0;
    // For now, assume full refund of amount paid
    const refundAmount = amountPaid;

    // Process actual refund if payment was made
    let refundResult: { success: boolean; refundId?: number; error?: string } =
      { success: false };
    if (amountPaid > 0 && order.payment_status === 'paid') {
      // Look up the transaction for this order
      const { data: transaction } = await supabase
        .from('transactions')
        .select('gateway, gateway_reference')
        .eq('order_id', id)
        .eq('transaction_type', 'payment')
        .eq('status', 'completed')
        .single();

      if (transaction?.gateway_reference) {
        // Initiate refund based on payment gateway
        if (transaction.gateway === 'paystack') {
          const paystackRefund = await initiatePaystackRefund(
            transaction.gateway_reference,
            refundAmount * 100, // Convert to kobo
            cancellationReason || 'Order cancelled'
          );
          refundResult = {
            success: paystackRefund.success,
            refundId: paystackRefund.data?.id,
            error: paystackRefund.error,
          };
        } else if (transaction.gateway === 'korapay') {
          // TODO: Implement Korapay refund
          logger.warn({
            message: 'Korapay refund not yet implemented',
            orderId: id,
            transactionRef: transaction.gateway_reference,
          });
          refundResult = {
            success: false,
            error: 'Korapay refund not yet implemented',
          };
        } else {
          logger.warn({
            message: 'Unsupported payment gateway for refund',
            gateway: transaction.gateway,
            orderId: id,
          });
          refundResult = {
            success: false,
            error: `Unsupported gateway: ${transaction.gateway}`,
          };
        }

        // Create refund transaction record
        if (refundResult.success) {
          await supabase.from('transactions').insert({
            merchant_id: order.merchant_id,
            order_id: id,
            transaction_type: 'refund',
            amount: refundAmount,
            currency: 'NGN',
            status: 'completed',
            gateway: transaction.gateway,
            gateway_reference: String(refundResult.refundId),
            description: `Refund for cancelled order #${order.order_number || id.slice(0, 8)}`,
          });
        }
      } else {
        logger.warn({
          message: 'No transaction found for refund',
          orderId: id,
        });
      }
    }

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
      supportEmail: merchant.support_email,
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
      refund:
        amountPaid > 0
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
