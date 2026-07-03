import { getCartItemEffectivePrice } from '@/lib/cart-pricing';
import type { CartItem } from '@/stores/cart-store';

export interface ShippingQuoteLike {
  id: string | number;
  price: number | string;
  isStationPickup?: boolean;
}

function normalizeShippingQuotePrice(value: number | string): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, value);
  }

  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d.-]/g, '');
    const parsed = Number(cleaned);

    if (Number.isFinite(parsed)) {
      return Math.max(0, parsed);
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
    getCartItemEffectivePrice(item),
  ]);
}

export function buildShippingQuoteContextKey(
  state: string,
  city: string,
  items: CartItem[],
  address = ''
): string {
  if (!state.trim() || !city.trim() || items.length === 0) {
    return '';
  }

  const itemKey = items.map(buildShippingQuoteItemKey).sort().join('|');

  return `${normalizeFragment(state)}::${normalizeFragment(city)}::${normalizeFragment(address)}::${itemKey}`;
}

export function getPreferredShippingQuoteId(
  quotes: ShippingQuoteLike[],
  previousSelectedQuoteId?: string | null
): string {
  if (quotes.length === 0) {
    return '';
  }

  const doorQuotes = quotes.filter((quote) => quote.isStationPickup !== true);
  const selectableQuotes = doorQuotes.length > 0 ? doorQuotes : quotes;

  if (
    previousSelectedQuoteId &&
    selectableQuotes.some(
      (quote) => String(quote.id) === String(previousSelectedQuoteId)
    )
  ) {
    return String(previousSelectedQuoteId);
  }

  return String(
    selectableQuotes.reduce((prev, current) =>
      normalizeShippingQuotePrice(prev.price) <=
      normalizeShippingQuotePrice(current.price)
        ? prev
        : current
    ).id
  );
}
