import { isProductNegotiable } from '@baci/shared/lib';
import type { CartItem } from '@/stores/cart-store';

type CartPriceInput = Pick<
  CartItem,
  'brand' | 'name' | 'negotiatedPrice' | 'negotiationStatus' | 'price'
>;

export function getActiveNegotiatedPrice(
  item: CartPriceInput
): number | undefined {
  if (item.negotiationStatus !== 'accepted') {
    return undefined;
  }

  if (typeof item.negotiatedPrice !== 'number') {
    return undefined;
  }

  if (!isProductNegotiable({ brand: item.brand, name: item.name })) {
    return undefined;
  }

  return item.negotiatedPrice;
}

export function hasActiveNegotiatedPrice(item: CartPriceInput): boolean {
  return getActiveNegotiatedPrice(item) !== undefined;
}

export function getCartItemEffectivePrice(item: CartPriceInput): number {
  return getActiveNegotiatedPrice(item) ?? item.price;
}
