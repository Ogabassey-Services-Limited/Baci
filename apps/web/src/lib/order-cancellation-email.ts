import type { SupabaseClient } from '@supabase/supabase-js';
import {
  generateOrderCancellationEmail,
  generateOrderCancellationText,
} from '@/lib/email-templates';
import { logger } from '@/lib/logger';
import { ORDER_WITH_ITEMS_QUERY } from '@/lib/order-queries';
import { sendEmail } from '@/lib/zeptomail';

/** Order item shape consumed by the cancellation email template. */
interface EmailOrderItem {
  name: string | null;
  quantity: number | null;
  price: number | null;
}

export interface SendOrderCancellationEmailParams {
  /** A Supabase client able to read the order + merchant (customer- or merchant-scoped). */
  supabase: SupabaseClient;
  orderId: string;
  cancelledBy: 'merchant' | 'customer';
  reason?: string;
  /** Amount to surface as refunded. 0 for the unpaid-only customer cancel MVP. */
  refundAmount?: number;
}

export interface SendOrderCancellationEmailResult {
  success: boolean;
  error?: string;
  messageId?: string;
}

/**
 * Fetches the order + merchant and sends the "Order Cancelled" email.
 *
 * Used by the customer cancellation route (and reusable by the merchant path).
 * The `cancelledBy` param shapes the copy. Callers treat email delivery as
 * best-effort: the cancellation itself has already been committed, so a failure
 * here is logged and surfaced via the result, not thrown.
 */
export async function sendOrderCancellationEmail({
  supabase,
  orderId,
  cancelledBy,
  reason,
  refundAmount = 0,
}: SendOrderCancellationEmailParams): Promise<SendOrderCancellationEmailResult> {
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(ORDER_WITH_ITEMS_QUERY)
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    logger.error({
      message: 'Cancellation email: order not found',
      orderId,
      error: orderError,
    });
    return { success: false, error: 'order_not_found_for_email' };
  }

  const { data: merchant, error: merchantError } = await supabase
    .from('merchants')
    .select(
      'id, business_name, slug, support_email, email_sender_name, email, tax_identification_number, cac_rc_number'
    )
    .eq('id', order.merchant_id)
    .single();

  if (merchantError || !merchant) {
    logger.error({
      message: 'Cancellation email: merchant not found',
      orderId,
      merchantId: order.merchant_id,
      error: merchantError,
    });
    return { success: false, error: 'merchant_not_found_for_email' };
  }

  if (!order.customer_email) {
    logger.warn({
      message: 'Cancellation email: order has no customer email',
      orderId,
    });
    return { success: false, error: 'no_customer_email' };
  }

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
  const merchantUrl = `https://${merchant.slug}.${rootDomain}`;

  const items = (order.order_items ?? []).map((item: EmailOrderItem) => ({
    name: item.name || 'Product',
    quantity: item.quantity || 1,
    price: item.price || 0,
  }));

  const cancellationData = {
    orderNumber: order.order_number || order.id.slice(0, 8).toUpperCase(),
    customerName: order.customer_name,
    items,
    totalAmount: Number(order.total) || 0,
    amountPaid: Number(order.amount_paid) || 0,
    refundAmount,
    cancellationReason: reason,
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

  const replyTo =
    merchant.support_email ||
    merchant.email ||
    `support@${merchant.slug}.${rootDomain}`;
  const fromName = merchant.email_sender_name || merchant.business_name;

  try {
    const emailResult = await sendEmail({
      to: order.customer_email,
      toName: order.customer_name ?? undefined,
      subject: `Order #${cancellationData.orderNumber} Has Been Cancelled`,
      htmlContent,
      textContent,
      replyTo,
      emailType: 'orders',
      fromName,
      auditContext: {
        merchantId: merchant.id,
        orderId: order.id,
        customerId: order.customer_id,
        metadata: {
          trigger: 'order_cancelled_notification',
          cancelledBy,
        },
      },
    });

    return {
      success: emailResult.success,
      error: emailResult.error,
      messageId: emailResult.messageId,
    };
  } catch (error) {
    logger.error({
      message: 'Cancellation email: sendEmail threw',
      orderId,
      error,
    });
    return { success: false, error: 'email_send_failed' };
  }
}
