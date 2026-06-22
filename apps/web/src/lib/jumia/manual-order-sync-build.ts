import type { JumiaClient } from '@/lib/jumia/client';
import { getOrderItems } from '@/lib/jumia/orders';
import { logger } from '@/lib/logger';
import { sanitizeText } from '@/lib/sanitize-core';
import type {
  ExistingJumiaOrderLookup,
  JumiaOrderWrite,
  ManualJumiaOrder,
} from './manual-order-sync-types';

function getCustomerName(
  shippingAddress: { firstName?: string; lastName?: string } | undefined
): string {
  if (!shippingAddress) return 'Unknown Customer';
  return (
    `${shippingAddress.firstName || ''} ${shippingAddress.lastName || ''}`.trim() ||
    'Unknown Customer'
  );
}

export async function buildJumiaOrderWrites(
  jumiaClient: JumiaClient,
  merchantId: string,
  jumiaOrders: ManualJumiaOrder[],
  existingOrdersMap: Map<string, ExistingJumiaOrderLookup>
): Promise<JumiaOrderWrite[]> {
  const pendingOrderWrites: JumiaOrderWrite[] = [];
  const stagedOrderIds = new Set<string>();

  for (const order of jumiaOrders) {
    const customerName = getCustomerName(order.shippingAddress);
    const orderId = String(order.id);
    if (stagedOrderIds.has(orderId)) continue;
    stagedOrderIds.add(orderId);

    const existingOrder = existingOrdersMap.get(orderId);
    let itemsFetched = false;
    let orderItems: Array<{
      id: string;
      product: { name: string; sellerSku: string; imageUrl: string };
      status: string;
      itemPrice: number;
      paidPrice: number;
    }> = [];

    try {
      const itemsResponse = await getOrderItems(jumiaClient, order.id);
      orderItems = itemsResponse.items.map((item) => ({
        id: item.id,
        product: item.product,
        status: item.status,
        itemPrice: item.itemPrice,
        paidPrice: item.paidPrice,
      }));
      itemsFetched = true;
    } catch (itemError) {
      logger.error({
        message: 'Failed to fetch items for Jumia order',
        orderId: order.id,
        error:
          itemError instanceof Error
            ? { message: itemError.message, stack: itemError.stack }
            : itemError,
      });
    }

    const shippingAddr = order.shippingAddress as
      | (Record<string, unknown> & { phone?: string })
      | undefined;
    const customerPhone =
      typeof shippingAddr?.phone === 'string' ? shippingAddr.phone : '';
    const sanitizedCustomerName = sanitizeText(customerName, 200);
    const sanitizedShippingAddress = order.shippingAddress
      ? Object.fromEntries(
          Object.entries(order.shippingAddress as Record<string, unknown>).map(
            ([key, value]) => [
              key,
              typeof value === 'string' ? sanitizeText(value, 500) : value,
            ]
          )
        )
      : {};
    const upsertPayload: Record<string, unknown> = {
      merchant_id: merchantId,
      jumia_order_id: orderId,
      jumia_order_number: String(order.number),
      jumia_shop_id: jumiaClient.shopId,
      status: order.status,
      customer_name: sanitizedCustomerName,
      customer_phone: sanitizeText(customerPhone, 50),
      shipping_address: sanitizedShippingAddress,
      total_amount: order.totalAmount?.value ?? 0,
      currency: order.totalAmount?.currency ?? 'NGN',
      created_at_jumia: order.createdAt,
    };

    if (itemsFetched) {
      upsertPayload.items = orderItems.map((item) => ({
        ...item,
        product: {
          ...item.product,
          name: sanitizeText(item.product.name, 300),
        },
      }));
    }

    pendingOrderWrites.push({
      currency: order.totalAmount?.currency ?? 'NGN',
      existingOrderId: existingOrder?.id ?? '',
      isNewOrder: !existingOrder,
      orderId,
      orderNumber: String(order.number),
      prefetchedNotificationSent: existingOrder?.notification_sent === true,
      sanitizedCustomerName,
      totalAmount: Number(order.totalAmount?.value ?? 0),
      upsertPayload,
    });
  }

  return pendingOrderWrites;
}
