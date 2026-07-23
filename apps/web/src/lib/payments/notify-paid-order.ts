import { notifyNewOrder, notifyPaymentReceived } from '@/lib/expo-push';
import { logger } from '@/lib/logger';
import type { RichPaidOrder } from '@/lib/payments/paid-order-side-effect-types';

// Merchant push pair for a freshly paid order. Push has no claim-gating
// (unlike the outbox), so callers must invoke this exactly once per order
// transition — the finalizer keys it to the RPC's order_updated flag.
export function schedulePaidOrderNotifications({
  merchantId,
  richOrder,
  scheduleAfter,
}: {
  merchantId: string;
  richOrder: RichPaidOrder;
  scheduleAfter: (task: () => Promise<void>) => void;
}): void {
  scheduleAfter(async () => {
    const orderAmount = Number(richOrder.total) || 0;
    const orderNumber =
      richOrder.order_number || richOrder.id.slice(0, 8).toUpperCase();
    try {
      await notifyNewOrder(
        merchantId,
        richOrder.id,
        orderNumber,
        richOrder.customer_name || 'Customer',
        orderAmount,
        richOrder.currency || 'NGN'
      );
    } catch (pushError) {
      logger.warn({
        error: pushError,
        message: 'New order push notification failed',
      });
    }
    try {
      await notifyPaymentReceived(
        merchantId,
        orderAmount,
        richOrder.currency || 'NGN',
        orderNumber,
        richOrder.id
      );
    } catch (pushError) {
      logger.warn({
        error: pushError,
        message: 'Payment received push notification failed',
      });
    }
  });
}
