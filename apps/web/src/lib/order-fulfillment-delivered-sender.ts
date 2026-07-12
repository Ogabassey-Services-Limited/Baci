import {
  generateOrderDeliveredEmail,
  generateOrderDeliveredText,
} from '@/lib/email-templates';
import { logger } from '@/lib/logger';
import {
  buildMerchantEmailContext,
  getFulfillmentOrderItems,
  getFulfillmentOrderNumber,
  handleFulfillmentEmailFailure,
} from '@/lib/order-fulfillment-notification-sender-helpers';
import type {
  FeatureSettingsRecord,
  FulfillmentOrderRecord,
  MerchantRecord,
  OrderFulfillmentNotificationResult,
} from '@/lib/order-fulfillment-notification-types';
import { resolveOrderNotificationRecipient } from '@/lib/order-notification-recipient';
import { sendEmail } from '@/lib/zeptomail';

interface SendDeliveredNotificationParams {
  beforeProviderDispatch?: () => Promise<void>;
  featureSettings: FeatureSettingsRecord | null;
  merchant: MerchantRecord;
  merchantId: string;
  order: FulfillmentOrderRecord;
}

export async function sendDeliveredNotification({
  beforeProviderDispatch,
  featureSettings,
  merchant,
  merchantId,
  order,
}: SendDeliveredNotificationParams): Promise<OrderFulfillmentNotificationResult> {
  const hasGoogleRating = Boolean(featureSettings?.google_place_id);
  const recipient = resolveOrderNotificationRecipient(order.customer_email);
  if (!recipient.ok) {
    logger.warn({
      message:
        'Skipping delivered email because order has no valid customer email',
      orderId: order.id,
      merchantId,
      customerId: order.customer_id,
      reason: recipient.reason,
    });
    return { status: 'skipped', reason: recipient.reason, hasGoogleRating };
  }
  const { merchantUrl, replyToEmail } = buildMerchantEmailContext(merchant);
  const deliveredData = {
    orderNumber: getFulfillmentOrderNumber(order),
    customerName: order.customer_name,
    items: getFulfillmentOrderItems(order),
    merchantName: merchant.business_name,
    merchantUrl,
    supportEmail: merchant.support_email ?? undefined,
    merchantTin: merchant.tax_identification_number ?? undefined,
    merchantRcNumber: merchant.cac_rc_number ?? undefined,
    googlePlaceId: featureSettings?.google_place_id || null,
  };
  const senderName = merchant.email_sender_name || merchant.business_name;
  const emailResult = await sendEmail({
    to: recipient.email,
    clientReference: `order:${order.id}:delivered_email`,
    toName: order.customer_name,
    subject: `Your Order #${deliveredData.orderNumber} Has Been Delivered! 🎉`,
    htmlContent: generateOrderDeliveredEmail(deliveredData),
    textContent: generateOrderDeliveredText(deliveredData),
    replyTo: replyToEmail,
    emailType: 'orders',
    fromName: senderName,
    beforeTransportDispatch: beforeProviderDispatch,
    auditContext: {
      merchantId,
      orderId: order.id,
      customerId: order.customer_id,
      metadata: { trigger: 'order_delivered_notification' },
    },
  });
  if (!emailResult.success) {
    return handleFulfillmentEmailFailure(
      emailResult,
      order.id,
      'Failed to send delivered email'
    );
  }
  logger.info({ message: 'Order delivered email sent', orderId: order.id });
  return {
    status: 'sent',
    message: 'Delivered notification sent',
    messageId: emailResult.messageId,
    hasGoogleRating,
  };
}
