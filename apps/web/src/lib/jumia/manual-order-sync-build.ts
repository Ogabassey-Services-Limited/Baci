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

function sanitizeShippingAddress(
  shippingAddress: ManualJumiaOrder['shippingAddress']
) {
  if (!shippingAddress) return undefined;

  const sanitizedEntries = Object.entries(
    shippingAddress as Record<string, unknown>
  ).flatMap(([key, value]) => {
    if (typeof value === 'string') {
      const sanitizedValue = sanitizeText(value, 500);
      return sanitizedValue ? [[key, sanitizedValue] as const] : [];
    }
    return value == null ? [] : [[key, value] as const];
  });

  return sanitizedEntries.length > 0
    ? Object.fromEntries(sanitizedEntries)
    : undefined;
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
    const sanitizedCustomerPhone = sanitizeText(customerPhone, 50);
    const sanitizedCustomerName = sanitizeText(customerName, 200);
    const sanitizedShippingAddress = sanitizeShippingAddress(
      order.shippingAddress
    );
    const actualTotalAmount =
      typeof order.totalAmount?.value === 'number' &&
      Number.isFinite(order.totalAmount.value)
        ? order.totalAmount.value
        : undefined;
    const actualCurrency =
      typeof order.totalAmount?.currency === 'string'
        ? sanitizeText(order.totalAmount.currency, 12)
        : '';
    const upsertPayload: Record<string, unknown> = {
      merchant_id: merchantId,
      jumia_order_id: orderId,
      jumia_order_number: String(order.number),
      jumia_shop_id: jumiaClient.shopId,
      status: order.status,
      customer_name: sanitizedCustomerName,
      created_at_jumia: order.createdAt,
    };

    if (sanitizedCustomerPhone) {
      upsertPayload.customer_phone = sanitizedCustomerPhone;
    }
    if (sanitizedShippingAddress) {
      upsertPayload.shipping_address = sanitizedShippingAddress;
    }
    if (actualTotalAmount !== undefined) {
      upsertPayload.total_amount = actualTotalAmount;
    }
    if (actualCurrency) {
      upsertPayload.currency = actualCurrency;
    }

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
      currency: actualCurrency || 'NGN',
      existingOrderId: existingOrder?.id ?? '',
      isNewOrder: !existingOrder,
      orderId,
      orderNumber: String(order.number),
      prefetchedNotificationSent: existingOrder?.notification_sent === true,
      sanitizedCustomerName,
      totalAmount: Number(actualTotalAmount ?? 0),
      upsertPayload,
    });
  }

  return pendingOrderWrites;
}
