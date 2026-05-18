import { logger } from '@/lib/logger';
import type { CartItem } from './cart-types';

interface CartValidationResponse {
  invalidProductIds?: string[];
  priceChanges?: {
    id: string;
    variantId?: string;
    oldPrice: number;
    newPrice: number;
  }[];
}

const createCartValidationKey = (id: string, variantId?: string | null) =>
  variantId ? `${id}::${variantId}` : id;

export const createCartHash = (cart: CartItem[]) => {
  return cart
    .map(
      (item) =>
        `${createCartValidationKey(item.id, item.variantId)}:${item.price}`
    )
    .sort()
    .join('|');
};

export const validateStorefrontCart = async (
  cart: CartItem[],
  signal: AbortSignal
) => {
  const limitedCart = cart.slice(0, 50).map((item) => ({
    id: item.id,
    price: item.price,
    variantId: item.variantId,
  }));

  const response = await fetch('/api/cart/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cartItems: limitedCart }),
    signal,
  });

  if (!response.ok) {
    logger.warn({
      message: 'Cart validation failed',
      status: response.status,
    });
    return null;
  }

  return (await response.json()) as CartValidationResponse;
};

export const applyValidationResults = (
  cart: CartItem[],
  validation: CartValidationResponse
) => {
  const invalidIds = new Set(validation.invalidProductIds || []);
  const priceChanges = new Map(
    (validation.priceChanges || []).map((priceChange) => [
      createCartValidationKey(priceChange.id, priceChange.variantId),
      priceChange,
    ])
  );

  if (invalidIds.size === 0 && priceChanges.size === 0) {
    return cart;
  }

  return cart
    .filter((item) => !invalidIds.has(item.id))
    .map((item) => {
      const priceChange = priceChanges.get(
        createCartValidationKey(item.id, item.variantId)
      );
      if (!priceChange) {
        return item;
      }

      logger.info({
        message: 'Updated stale price in cart',
        productId: item.id,
        oldPrice: priceChange.oldPrice,
        newPrice: priceChange.newPrice,
      });

      return { ...item, price: priceChange.newPrice };
    });
};
