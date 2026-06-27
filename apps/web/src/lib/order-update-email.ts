import type { OrderEditChangeCategory } from '@baci/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/env';
import {
  generateOrderUpdatedEmail,
  generateOrderUpdatedText,
} from '@/lib/email-templates';
import { logger } from '@/lib/logger';
import { ORDER_WITH_ITEMS_QUERY } from '@/lib/order-queries';
import { sendEmail } from '@/lib/zeptomail';

export interface SendOrderUpdatedEmailParams {
  changeCategory: OrderEditChangeCategory;
  changedFields: string[];
  orderId: string;
  supabase: SupabaseClient;
}

export interface SendOrderUpdatedEmailResult {
  error?: string;
  messageId?: string;
  success: boolean;
}

function parseFiniteOrderTotal(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export async function sendOrderUpdatedEmail({
  changeCategory,
  changedFields,
  orderId,
  supabase,
}: SendOrderUpdatedEmailParams): Promise<SendOrderUpdatedEmailResult> {
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(ORDER_WITH_ITEMS_QUERY)
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    logger.error({
      error: orderError,
      message: 'Order update email: order not found',
      orderId,
    });
    return { error: 'order_not_found_for_email', success: false };
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
      error: merchantError,
      merchantId: order.merchant_id,
      message: 'Order update email: merchant not found',
      orderId,
    });
    return { error: 'merchant_not_found_for_email', success: false };
  }

  if (!order.customer_email) {
    logger.warn({
      message: 'Order update email: order has no customer email',
      orderId,
    });
    return { error: 'no_customer_email', success: false };
  }

  const rootDomain = env.NEXT_PUBLIC_ROOT_DOMAIN;
  const merchantUrl = `https://${merchant.slug}.${rootDomain}`;
  const orderNumber = order.order_number || order.id.slice(0, 8).toUpperCase();
  const supportEmail =
    merchant.support_email ||
    merchant.email ||
    `support@${merchant.slug}.${rootDomain}`;
  const customerName = order.customer_name?.trim() || 'there';
  const totalAmount = parseFiniteOrderTotal(order.total);

  if (totalAmount === null) {
    logger.error({
      message: 'Order update email: invalid order total',
      orderId,
      total: order.total,
    });
    return { error: 'invalid_order_total_for_email', success: false };
  }

  const templateData = {
    changedFields,
    currency: typeof order.currency === 'string' ? order.currency : undefined,
    customerName,
    merchantName: merchant.business_name,
    merchantRcNumber: merchant.cac_rc_number ?? undefined,
    merchantTin: merchant.tax_identification_number ?? undefined,
    merchantUrl,
    orderNumber,
    supportEmail,
    totalAmount,
  };

  const replyTo = supportEmail;
  const fromName = merchant.email_sender_name || merchant.business_name;

  try {
    const result = await sendEmail({
      auditContext: {
        customerId: order.customer_id,
        merchantId: merchant.id,
        metadata: {
          changeCategory,
          changedFields,
          trigger: 'order_updated_notification',
        },
        orderId: order.id,
      },
      emailType: 'orders',
      fromName,
      htmlContent: generateOrderUpdatedEmail(templateData),
      replyTo,
      subject: `Order #${orderNumber} Has Been Updated`,
      textContent: generateOrderUpdatedText(templateData),
      to: order.customer_email,
      toName: order.customer_name ?? undefined,
    });

    return {
      error: result.error,
      messageId: result.messageId,
      success: result.success,
    };
  } catch (error) {
    logger.error({
      error,
      message: 'Order update email: sendEmail threw',
      orderId,
    });
    return { error: 'email_send_failed', success: false };
  }
}
