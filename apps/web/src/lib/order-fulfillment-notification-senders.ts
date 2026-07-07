import {
  generateOrderDeliveredEmail,
  generateOrderDeliveredText,
  generateOrderShippedEmail,
  generateOrderShippedText,
} from '@/lib/email-templates';
import { logger } from '@/lib/logger';
import type {
  FeatureSettingsRecord,
  FulfillmentOrderRecord,
  MerchantRecord,
  OrderFulfillmentNotificationEventType,
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

interface SendDeliveredNotificationParams {
  featureSettings: FeatureSettingsRecord | null;
  merchant: MerchantRecord;
  merchantId: string;
  order: FulfillmentOrderRecord;
}

interface SendFulfillmentNotificationEmailParams {
  courierName?: string;
  estimatedDelivery?: string;
  eventType: OrderFulfillmentNotificationEventType;
  featureSettings?: FeatureSettingsRecord | null;
  merchant: MerchantRecord;
  merchantId: string;
  order: FulfillmentOrderRecord;
  trackingNumber?: string;
}

function buildMerchantEmailContext(merchant: MerchantRecord) {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
  return {
    merchantUrl: `https://${merchant.slug}.${rootDomain}`,
    replyToEmail:
      merchant.support_email ||
      merchant.email ||
      `support@${merchant.slug}.${rootDomain}`,
    rootDomain,
  };
}

function handleEmailFailure(
  emailResult: { error?: string; success: boolean },
  orderId: string,
  fallbackMessage: string
): OrderFulfillmentNotificationResult {
  const error = emailResult.error || fallbackMessage;
  logger.error({
    message: fallbackMessage,
    error,
    orderId,
  });
  return { status: 'failed', error, details: emailResult.error };
}

function buildTrackingUrl(
  rootDomain: string,
  merchantSlug: string,
  order: FulfillmentOrderRecord,
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

function orderNumberFor(order: FulfillmentOrderRecord): string {
  return order.order_number || order.id.slice(0, 8).toUpperCase();
}

function orderItemsFor(order: FulfillmentOrderRecord) {
  return (
    order.order_items?.map((item) => ({
      name: item.name || 'Product',
      quantity: item.quantity || 1,
    })) || []
  );
}

async function sendShippedNotification({
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
  const trackingUrl = buildTrackingUrl(
    rootDomain,
    merchant.slug,
    order,
    resolvedTrackingNumber
  );

  const shippedData = {
    orderNumber: orderNumberFor(order),
    customerName: order.customer_name,
    items: orderItemsFor(order),
    shippingAddress: {
      address: order.shipping_address?.address || '',
      city: order.shipping_address?.city || '',
      state: order.shipping_address?.state || '',
      phone: order.customer_phone || '',
    },
    trackingNumber: resolvedTrackingNumber,
    trackingUrl,
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
      metadata: {
        trigger: 'order_shipped_notification',
      },
    },
  });

  if (!emailResult.success) {
    return handleEmailFailure(
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

async function sendDeliveredNotification({
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
    orderNumber: orderNumberFor(order),
    customerName: order.customer_name,
    items: orderItemsFor(order),
    merchantName: merchant.business_name,
    merchantUrl,
    supportEmail: merchant.support_email ?? undefined,
    merchantTin: merchant.tax_identification_number ?? undefined,
    merchantRcNumber: merchant.cac_rc_number ?? undefined,
    googlePlaceId: featureSettings?.google_place_id || null,
  };

  const senderName = merchant.email_sender_name
    ? `${merchant.email_sender_name}`
    : `${merchant.business_name}`;

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
    return handleEmailFailure(
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

export function sendFulfillmentNotificationEmail({
  courierName,
  estimatedDelivery,
  eventType,
  featureSettings = null,
  merchant,
  merchantId,
  order,
  trackingNumber,
}: SendFulfillmentNotificationEmailParams): Promise<OrderFulfillmentNotificationResult> {
  if (eventType === 'order_shipped') {
    return sendShippedNotification({
      courierName,
      estimatedDelivery,
      merchant,
      merchantId,
      order,
      trackingNumber,
    });
  }

  return sendDeliveredNotification({
    featureSettings,
    merchant,
    merchantId,
    order,
  });
}
