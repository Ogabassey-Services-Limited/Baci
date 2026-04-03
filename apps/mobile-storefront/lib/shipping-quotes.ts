import type { CartItem } from '@/stores/cart-store';

export interface ShippingQuoteLike {
  id: string | number;
  price: number | string;
}

export function normalizeShippingQuotePrice(value: number | string): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d.-]/g, '');
    const parsed = Number(cleaned);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

export function normalizeShippingQuotes<T extends ShippingQuoteLike>(
  quotes: T[]
): Array<T & { price: number }> {
  return quotes.map((quote) => ({
    ...quote,
    price: normalizeShippingQuotePrice(quote.price),
  }));
}

function normalizeFragment(value: string): string {
  return value.trim().toLowerCase();
}

function buildShippingQuoteItemKey(item: CartItem): string {
  return JSON.stringify([
    item.product_id ?? '',
    item.variant_id ?? '',
    item.quantity,
    item.negotiatedPrice ?? item.price,
  ]);
}

export function buildShippingQuoteContextKey(
  state: string,
  city: string,
  items: CartItem[]
): string {
  if (!state.trim() || !city.trim() || items.length === 0) {
    return '';
  }

  const itemKey = items
    .map(buildShippingQuoteItemKey)
    .sort()
    .join('|');

  return `${normalizeFragment(state)}::${normalizeFragment(city)}::${itemKey}`;
}

export function getPreferredShippingQuoteId(
  quotes: ShippingQuoteLike[],
  previousSelectedQuoteId?: string | null
): string {
  if (quotes.length === 0) {
    return '';
  }

  if (
    previousSelectedQuoteId &&
    quotes.some((quote) => String(quote.id) === String(previousSelectedQuoteId))
  ) {
    return String(previousSelectedQuoteId);
  }

  return String(
    quotes.reduce((prev, current) =>
      normalizeShippingQuotePrice(prev.price) <=
        normalizeShippingQuotePrice(current.price)
        ? prev
        : current
    ).id
  );
}
