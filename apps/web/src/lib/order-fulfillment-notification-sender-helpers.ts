import { logger } from '@/lib/logger';
import type {
  FulfillmentOrderRecord,
  MerchantRecord,
  OrderFulfillmentNotificationResult,
} from '@/lib/order-fulfillment-notification-types';

export function buildMerchantEmailContext(merchant: MerchantRecord) {
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

export function handleFulfillmentEmailFailure(
  emailResult: {
    deliveryOutcome?: 'unknown';
    error?: string;
    success: boolean;
  },
  orderId: string,
  fallbackMessage: string
): OrderFulfillmentNotificationResult {
  const error = emailResult.error || fallbackMessage;
  logger.error({ message: fallbackMessage, error, orderId });
  return {
    status: 'failed',
    error,
    details: emailResult.error,
    ...(emailResult.deliveryOutcome
      ? { deliveryOutcome: emailResult.deliveryOutcome }
      : {}),
  };
}

export function buildFulfillmentTrackingUrl(
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

export function getFulfillmentOrderNumber(
  order: FulfillmentOrderRecord
): string {
  return order.order_number || order.id.slice(0, 8).toUpperCase();
}

export function getFulfillmentOrderItems(order: FulfillmentOrderRecord) {
  return (
    order.order_items?.map((item) => ({
      name: item.name || 'Product',
      quantity: item.quantity || 1,
    })) || []
  );
}
