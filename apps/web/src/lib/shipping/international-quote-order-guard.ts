import { OrderShipmentBookingError } from './order-shipment-booking-utils';
import type { QuoteRequest } from './types';

type OrderShippingAddress = {
  address?: string | null;
  city?: string | null;
  state?: string | null;
};

type OrderItemRecord = {
  name: string | null;
  quantity: number | null;
  price: number | string | null;
};

type InternationalQuoteOrder = {
  shipping_address: OrderShippingAddress | null;
  order_items: OrderItemRecord[] | null;
};

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeAmount(value: number | string | null | undefined): number {
  return Number(value ?? 0);
}

function throwMismatch(): never {
  throw new OrderShipmentBookingError(
    'The saved international shipping quote no longer matches this order. Please get a new quote before shipping.',
    400,
    'INTERNATIONAL_QUOTE_ORDER_MISMATCH'
  );
}

export function assertInternationalQuoteMatchesOrder(
  quoteRequest: QuoteRequest,
  order: InternationalQuoteOrder
): void {
  const orderAddress = order.shipping_address;
  if (!orderAddress) {
    throwMismatch();
  }

  if (
    normalizeText(orderAddress.address) !==
      normalizeText(quoteRequest.receiver.address) ||
    normalizeText(orderAddress.city) !==
      normalizeText(quoteRequest.receiver.city) ||
    normalizeText(orderAddress.state) !==
      normalizeText(quoteRequest.receiver.state)
  ) {
    throwMismatch();
  }

  const orderItems = order.order_items ?? [];
  if (orderItems.length !== quoteRequest.items.length) {
    throwMismatch();
  }

  for (const [index, quoteItem] of quoteRequest.items.entries()) {
    const orderItem = orderItems[index];
    if (
      !orderItem ||
      normalizeText(orderItem.name) !== normalizeText(quoteItem.name) ||
      (orderItem.quantity ?? 1) !== quoteItem.quantity ||
      normalizeAmount(orderItem.price) !== quoteItem.value
    ) {
      throwMismatch();
    }
  }
}
