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
  weight?: number | string | null;
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
    amountsMatch(orderItem.price, quoteItem.value) &&
    (orderItem.weight === undefined ||
      amountsMatch(orderItem.weight, quoteItem.weight))
  );
}

function throwMismatch(
  message = 'The saved international shipping quote no longer matches this order. Please get a new quote before shipping.',
  code = 'INTERNATIONAL_QUOTE_ORDER_MISMATCH'
): never {
  throw new OrderShipmentBookingError(message, 400, code);
}

/**
 * Verify that a quote's attested receiver still matches the order destination.
 *
 * Shipping quotes are calculated from the receiver address. This check is
 * intentionally independent of shipment type so domestic bookings cannot use
 * a quote calculated for a different address after an order edit.
 */
export function assertQuoteReceiverMatchesOrder(
  quoteRequest: QuoteRequest,
  order: Pick<InternationalQuoteOrder, 'shipping_address'>
): void {
  const orderAddress = order.shipping_address;
  if (
    !orderAddress ||
    normalizeText(orderAddress.address) !==
      normalizeText(quoteRequest.receiver.address) ||
    normalizeText(orderAddress.city) !==
      normalizeText(quoteRequest.receiver.city) ||
    normalizeText(orderAddress.state) !==
      normalizeText(quoteRequest.receiver.state) ||
    !matchesOptionalText(
      orderAddress.country || 'Nigeria',
      quoteRequest.receiver.country
    ) ||
    !matchesOptionalText(
      orderAddress.countryCode || 'NG',
      quoteRequest.receiver.countryCode
    ) ||
    !matchesOptionalText(
      orderAddress.postalCode ?? orderAddress.postal_code,
      quoteRequest.receiver.postalCode
    )
  ) {
    throwMismatch(
      'The saved shipping quote no longer matches this order destination. Please get a new quote before shipping.',
      'SHIPPING_QUOTE_RECEIVER_MISMATCH'
    );
  }
}

export function assertInternationalQuoteMatchesOrder(
  quoteRequest: QuoteRequest,
  order: InternationalQuoteOrder
): void {
  try {
    assertQuoteReceiverMatchesOrder(quoteRequest, order);
  } catch (error) {
    if (
      error instanceof OrderShipmentBookingError &&
      error.code === 'SHIPPING_QUOTE_RECEIVER_MISMATCH'
    ) {
      throwMismatch();
    }
    throw error;
  }

  assertQuoteItemsMatchOrder(quoteRequest, order.order_items ?? [], {
    message:
      'The saved international shipping quote no longer matches this order. Please get a new quote before shipping.',
    code: 'INTERNATIONAL_QUOTE_ORDER_MISMATCH',
  });
}

export function assertQuoteItemsMatchOrder(
  quoteRequest: QuoteRequest,
  orderItems: OrderItemRecord[] | null | undefined,
  mismatch: { message: string; code: string } = {
    message:
      'The saved shipping quote no longer matches this order. Please get a new quote before shipping.',
    code: 'SHIPPING_QUOTE_ITEMS_MISMATCH',
  }
): void {
  const items = orderItems ?? [];
  if (items.length !== quoteRequest.items.length) {
    throwMismatch(mismatch.message, mismatch.code);
  }

  const unmatchedOrderItems = [...items];
  for (const quoteItem of quoteRequest.items) {
    const orderItemIndex = unmatchedOrderItems.findIndex((orderItem) =>
      matchesQuoteItem(orderItem, quoteItem)
    );
    if (orderItemIndex === -1) {
      throwMismatch(mismatch.message, mismatch.code);
    }
    unmatchedOrderItems.splice(orderItemIndex, 1);
  }
}
