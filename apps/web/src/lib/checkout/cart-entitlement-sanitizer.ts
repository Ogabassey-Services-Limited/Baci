import type { CartItem } from '@/hooks/cart';

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
export function calculateCartTotal(
  cart: CartItem[],
  hasPriceNegotiation: boolean
): number {
  try {
    const sanitizedCart = sanitizeCartItems(cart, hasPriceNegotiation);
    return sanitizedCart.reduce((total, item) => {
      const rawPrice = item.negotiatedPrice ?? item.price;
      const price =
        typeof rawPrice === 'number' && !Number.isNaN(rawPrice)
          ? rawPrice
          : 0;
      const quantity =
        typeof item.quantity === 'number' && !Number.isNaN(item.quantity)
          ? item.quantity
          : 0;
      const itemTotal = price * quantity;
      const assuranceCost = item.hasAssurance
        ? itemTotal * (item.assuranceRate ?? 0.05)
        : 0;
      return total + itemTotal + assuranceCost;
    }, 0);
  } catch (e) {
    console.error('Error calculating cart total:', e);
    return 0;
  }
}
