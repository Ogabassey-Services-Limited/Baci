import {
  generateOrderShippedEmail,
  generateOrderShippedText,
} from '@/lib/email-templates';
import { logger } from '@/lib/logger';
import {
  buildFulfillmentTrackingUrl,
  buildMerchantEmailContext,
  getFulfillmentOrderItems,
  getFulfillmentOrderNumber,
  handleFulfillmentEmailFailure,
} from '@/lib/order-fulfillment-notification-sender-helpers';
import type {
  FulfillmentOrderRecord,
  MerchantRecord,
  OrderFulfillmentNotificationResult,
} from '@/lib/order-fulfillment-notification-types';
import { resolveOrderNotificationRecipient } from '@/lib/order-notification-recipient';
import { sendEmail } from '@/lib/zeptomail';

interface SendShippedNotificationParams {
  courierName?: string;
  estimatedDelivery?: string;
  merchant: MerchantRecord;
  merchantId: string;
  order: FulfillmentOrderRecord;
  trackingNumber?: string;
}

export async function sendShippedNotification({
  courierName,
  estimatedDelivery,
  merchant,
  merchantId,
  order,
  trackingNumber,
}: SendShippedNotificationParams): Promise<OrderFulfillmentNotificationResult> {
  const recipient = resolveOrderNotificationRecipient(order.customer_email);
  if (!recipient.ok) {
    logger.warn({
      message:
        'Skipping shipped email because order has no valid customer email',
      orderId: order.id,
      merchantId,
      customerId: order.customer_id,
      reason: recipient.reason,
    });
    return { status: 'skipped', reason: recipient.reason };
  }

  const { merchantUrl, replyToEmail, rootDomain } =
    buildMerchantEmailContext(merchant);
  const resolvedTrackingNumber =
    trackingNumber || order.tracking_number || undefined;
  const resolvedCourierName =
    courierName || order.shipping_provider || undefined;
  const shippedData = {
    orderNumber: getFulfillmentOrderNumber(order),
    customerName: order.customer_name,
    items: getFulfillmentOrderItems(order),
    shippingAddress: {
      address: order.shipping_address?.address || '',
      city: order.shipping_address?.city || '',
      state: order.shipping_address?.state || '',
      phone: order.customer_phone || '',
    },
    trackingNumber: resolvedTrackingNumber,
    trackingUrl: buildFulfillmentTrackingUrl(
      rootDomain,
      merchant.slug,
      order,
      resolvedTrackingNumber
    ),
    courierName: resolvedCourierName,
    estimatedDelivery,
    merchantName: merchant.business_name,
    merchantUrl,
    supportEmail: merchant.support_email ?? undefined,
    merchantTin: merchant.tax_identification_number ?? undefined,
    merchantRcNumber: merchant.cac_rc_number ?? undefined,
  };
  const senderName = merchant.email_sender_name
    ? `${merchant.email_sender_name} Shipping`
    : `${merchant.business_name} Shipping`;
  const emailResult = await sendEmail({
    to: recipient.email,
    clientReference: `order:${order.id}:shipped_email`,
    toName: order.customer_name,
    subject: `Your Order #${shippedData.orderNumber} Has Shipped! 🚚`,
    htmlContent: generateOrderShippedEmail(shippedData),
    textContent: generateOrderShippedText(shippedData),
    replyTo: replyToEmail,
    emailType: 'orders',
    fromName: senderName,
    auditContext: {
      merchantId,
      orderId: order.id,
      customerId: order.customer_id,
      metadata: { trigger: 'order_shipped_notification' },
    },
  });
  if (!emailResult.success) {
    return handleFulfillmentEmailFailure(
      emailResult,
      order.id,
      'Failed to send shipped email'
    );
  }
  logger.info({ message: 'Order shipped email sent', orderId: order.id });
  return {
    status: 'sent',
    message: 'Shipped notification sent',
    messageId: emailResult.messageId,
  };
}
