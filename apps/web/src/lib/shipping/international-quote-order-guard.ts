import { OrderShipmentBookingError } from './order-shipment-booking-utils';
import type { QuoteRequest } from './types';

type OrderShippingAddress = {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  countryCode?: string | null;
  postal_code?: string | null;
  postalCode?: string | null;
};

type OrderItemRecord = {
  name: string | null;
  price?: number | string | null;
  quantity: number | null;
};

export type InternationalQuoteOrder = {
  shipping_address: OrderShippingAddress | null;
  order_items: OrderItemRecord[] | null;
};

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function hasComparableText(value: string | null | undefined): boolean {
  return normalizeText(value).length > 0;
}

function matchesOptionalText(
  orderValue: string | null | undefined,
  quoteValue: string | null | undefined
): boolean {
  const hasOrderValue = hasComparableText(orderValue);
  const hasQuoteValue = hasComparableText(quoteValue);
  if (!hasOrderValue && !hasQuoteValue) return true;
  if (!hasOrderValue || !hasQuoteValue) return false;
  return normalizeText(orderValue) === normalizeText(quoteValue);
}

function normalizeAmount(value: number | string | null | undefined) {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed)
    ? parsed
    : undefined;
}

function amountsMatch(
  orderValue: number | string | null | undefined,
  quoteValue: number
) {
  const normalizedOrderValue = normalizeAmount(orderValue);
  return (
    normalizedOrderValue !== undefined &&
    Math.abs(normalizedOrderValue - quoteValue) <= 0.001
  );
}

function matchesQuoteItem(
  orderItem: OrderItemRecord,
  quoteItem: QuoteRequest['items'][number]
): boolean {
  return (
    normalizeText(orderItem.name) === normalizeText(quoteItem.name) &&
    (orderItem.quantity ?? 1) === quoteItem.quantity &&
    amountsMatch(orderItem.price, quoteItem.value)
  );
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
      normalizeText(quoteRequest.receiver.state) ||
    !matchesOptionalText(orderAddress.country, quoteRequest.receiver.country) ||
    !matchesOptionalText(
      orderAddress.countryCode,
      quoteRequest.receiver.countryCode
    ) ||
    !matchesOptionalText(
      orderAddress.postalCode ?? orderAddress.postal_code,
      quoteRequest.receiver.postalCode
    )
  ) {
    throwMismatch();
  }

  const orderItems = order.order_items ?? [];
  if (orderItems.length !== quoteRequest.items.length) {
    throwMismatch();
  }

  const unmatchedOrderItems = [...orderItems];
  for (const quoteItem of quoteRequest.items) {
    const orderItemIndex = unmatchedOrderItems.findIndex((orderItem) =>
      matchesQuoteItem(orderItem, quoteItem)
    );
    if (orderItemIndex === -1) {
      throwMismatch();
    }
    unmatchedOrderItems.splice(orderItemIndex, 1);
  }
}
