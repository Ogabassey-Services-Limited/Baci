import type { CartItem } from '@/hooks/cart';
import { DEFAULT_ASSURANCE_RATE } from '@/lib/checkout/constants';

/**
 * Strips negotiation-related fields from cart items if the merchant is not entitled to price negotiation.
 */
export function sanitizeCartItems(
  cart: CartItem[],
  hasPriceNegotiation: boolean
): CartItem[] {
  return cart.map((item) => {
    if (!hasPriceNegotiation) {
      return {
        ...item,
        negotiatedPrice: undefined,
        negotiationStatus: undefined,
        cartDiscount: undefined,
      };
    }
    return item;
  });
}

/**
 * Calculates the total of the cart, taking into account negotiated price (if entitled) and quantity-aware assurance fees.
 */
export function isQuizVoucherCartItem(item: CartItem): boolean {
  return Boolean(item.quizAwardId && item.quizVoucherToken);
}

export function getCartItemCheckoutUnitPrice(item: CartItem): number {
  if (isQuizVoucherCartItem(item)) {
    return 0;
  }

  const rawPrice = item.negotiatedPrice ?? item.price;
  return typeof rawPrice === 'number' && !Number.isNaN(rawPrice) ? rawPrice : 0;
}

export function calculateCartItemSubtotal(
  cart: CartItem[],
  hasPriceNegotiation: boolean
): number {
  const sanitizedCart = sanitizeCartItems(cart, hasPriceNegotiation);
  return sanitizedCart.reduce((total, item) => {
    const price = getCartItemCheckoutUnitPrice(item);
    const quantity =
      typeof item.quantity === 'number' && !Number.isNaN(item.quantity)
        ? item.quantity
        : 0;
    return total + price * quantity;
  }, 0);
}

export function calculateCartTotal(
  cart: CartItem[],
  hasPriceNegotiation: boolean
): number {
  const sanitizedCart = sanitizeCartItems(cart, hasPriceNegotiation);
  return sanitizedCart.reduce((total, item) => {
    const price = getCartItemCheckoutUnitPrice(item);
    const quantity =
      typeof item.quantity === 'number' && !Number.isNaN(item.quantity)
        ? item.quantity
        : 0;
    const itemTotal = price * quantity;
    const assuranceCost = item.hasAssurance
      ? itemTotal * (item.assuranceRate ?? DEFAULT_ASSURANCE_RATE)
      : 0;
    return total + itemTotal + assuranceCost;
  }, 0);
}
