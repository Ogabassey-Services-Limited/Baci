import { notifyNewOrder, notifyPaymentReceived } from '@/lib/expo-push';
import { logger } from '@/lib/logger';

export interface KlumpPaidOrder {
  currency?: string | null;
  customer_name?: string | null;
  id: string;
  order_number?: string | null;
  total?: number | string | null;
}

export async function notifyKlumpPaidOrder({
  amount,
  currency,
  merchantId,
  order,
}: {
  amount: number;
  currency: string;
  merchantId: string;
  order: KlumpPaidOrder;
}) {
  const orderNumber = order.order_number || order.id.slice(0, 8).toUpperCase();

  try {
    await notifyNewOrder(
      merchantId,
      order.id,
      orderNumber,
      order.customer_name || 'Customer',
      amount,
      currency
    );
    await notifyPaymentReceived(
      merchantId,
      amount,
      currency,
      orderNumber,
      order.id
    );
  } catch (error) {
    logger.warn({ message: 'Klump payment notification failed', error });
  }
}
