import type { CartItem } from '@/stores/cart-store';

export interface ShippingQuoteLike {
  id: string | number;
  price: number;
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
      prev.price <= current.price ? prev : current
    ).id
  );
}
