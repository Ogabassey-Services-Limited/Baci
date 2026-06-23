import type { CartItem } from './cart-store.types';

const NGN_PRICE_FORMATTER = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * Format price in Naira
 */
export function formatPrice(amount: number): string {
  return NGN_PRICE_FORMATTER.format(amount);
}

let cachedCartItems: CartItem[] | null = null;
let cachedCartQuantities = new Map<string, number>();

/**
 * Memoized map of `product_id` → total quantity, rebuilt only when `items`
 * changes. Returns a read-only map (do not mutate the shared cache). Lets each
 * product card read its count in O(1) (a number primitive) instead of an
 * O(items) filter+reduce scan per card.
 */
export function selectCartQuantities(state: {
  items: CartItem[];
}): ReadonlyMap<string, number> {
  if (state.items !== cachedCartItems) {
    cachedCartItems = state.items;
    const next = new Map<string, number>();
    for (const item of state.items) {
      const key = String(item.product_id);
      next.set(key, (next.get(key) ?? 0) + item.quantity);
    }
    cachedCartQuantities = next;
  }
  return cachedCartQuantities;
}
