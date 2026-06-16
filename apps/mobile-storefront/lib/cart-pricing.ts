import { isProductNegotiable } from '@baci/shared/lib';
import type { CartItem } from '@/stores/cart-store';

type CartPriceInput = Pick<
  CartItem,
  'brand' | 'name' | 'negotiatedPrice' | 'negotiationStatus' | 'price'
>;

const isValidCartPrice = (value: number) =>
  Number.isFinite(value) && value >= 0;

export function getCartItemBasePrice(item: CartPriceInput): number {
  return isValidCartPrice(item.price) ? item.price : 0;
}

export function getActiveNegotiatedPrice(
  item: CartPriceInput
): number | undefined {
  if (item.negotiationStatus !== 'accepted') {
    return undefined;
  }

  const basePrice = getCartItemBasePrice(item);
  if (basePrice !== item.price) {
    return undefined;
  }

  if (
    typeof item.negotiatedPrice !== 'number' ||
    !isValidCartPrice(item.negotiatedPrice) ||
    item.negotiatedPrice > basePrice
  ) {
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
  return getActiveNegotiatedPrice(item) ?? getCartItemBasePrice(item);
}
