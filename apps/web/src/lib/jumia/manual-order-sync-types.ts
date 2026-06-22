import type { getAllOrders } from '@/lib/jumia/orders';

export type ExistingJumiaOrderLookup = {
  id: string;
  jumia_order_id: string;
  notification_sent: boolean | null;
};

export type JumiaOrderWrite = {
  currency: string;
  existingOrderId: string;
  isNewOrder: boolean;
  orderId: string;
  orderNumber: string;
  prefetchedNotificationSent: boolean;
  sanitizedCustomerName: string;
  totalAmount: number;
  upsertPayload: Record<string, unknown>;
};

export type ManualJumiaOrderSyncResult = {
  newOrders: number;
  success: boolean;
  synced: number;
};

export type ManualJumiaOrder = Awaited<ReturnType<typeof getAllOrders>>[number];
