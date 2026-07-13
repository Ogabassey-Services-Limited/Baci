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
  beforeProviderDispatch?: () => Promise<void>;
  resetProviderDispatch?: () => Promise<void>;
  courierName?: string | null;
  estimatedDelivery?: string;
  eventType: OrderFulfillmentNotificationEventType;
  featureSettings?: FeatureSettingsRecord | null;
  merchant: MerchantRecord;
  merchantId: string;
  order: FulfillmentOrderRecord;
  trackingNumber?: string | null;
}

export function sendFulfillmentNotificationEmail({
  beforeProviderDispatch,
  courierName,
  estimatedDelivery,
  eventType,
  featureSettings = null,
  merchant,
  merchantId,
  order,
  resetProviderDispatch,
  trackingNumber,
}: SendFulfillmentNotificationEmailParams): Promise<OrderFulfillmentNotificationResult> {
  if (eventType === 'order_shipped') {
    return sendShippedNotification({
      beforeProviderDispatch,
      courierName,
      estimatedDelivery,
      merchant,
      merchantId,
      order,
      resetProviderDispatch,
      trackingNumber,
    });
  }
  return sendDeliveredNotification({
    beforeProviderDispatch,
    featureSettings,
    merchant,
    merchantId,
    order,
    resetProviderDispatch,
  });
}
