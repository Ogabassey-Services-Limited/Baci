import { sendDeliveredNotification } from '@/lib/order-fulfillment-delivered-sender';
import type {
  FeatureSettingsRecord,
  FulfillmentOrderRecord,
  MerchantRecord,
  OrderFulfillmentNotificationEventType,
  OrderFulfillmentNotificationResult,
} from '@/lib/order-fulfillment-notification-types';
import { sendShippedNotification } from '@/lib/order-fulfillment-shipped-sender';

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
