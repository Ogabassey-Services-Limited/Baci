import { logger } from '@/lib/logger';
import type { AddToCartOptions, CartItem } from './cart-types';

const CART_STORAGE_KEY = 'baci-cart';
const GUEST_CART_SUFFIX = 'guest';

export const DEFAULT_ASSURANCE_RATE = 0.05;
export const DEFAULT_DEFERRED_VALIDATION_TIMEOUT_MS = 2500;
const MERCHANT_SLUG_KEY = 'baci-cart-merchant-slug';

export const getStorefrontCartStorageKey = (slug?: string | null) => {
  return slug
    ? `${CART_STORAGE_KEY}-${slug}-${GUEST_CART_SUFFIX}`
    : `${CART_STORAGE_KEY}-${GUEST_CART_SUFFIX}`;
};

export const generateCartItemId = (
  productId: string,
  options?: AddToCartOptions
): string => {
  const parts = [productId];
  if (options?.variantId) parts.push(`variant=${options.variantId}`);
  if (options?.color) parts.push(`color=${options.color}`);
  if (options?.secondaryColor) {
    parts.push(`secondaryColor=${options.secondaryColor}`);
  }
  if (options?.condition) parts.push(`condition=${options.condition}`);

  if (options) {
    const skipKeys = new Set([
      'variantId',
      'variantAttributes',
      'color',
      'colorValue',
      'secondaryColor',
      'secondaryColorValue',
      'condition',
    ]);

    for (const key of Object.keys(options).sort()) {
      if (skipKeys.has(key)) continue;
      const value = options[key];
      if (typeof value === 'string' && value) {
        parts.push(`${key}=${value}`);
      }
    }
  }

  return parts.join('::');
};

export const getCartFromStorage = (slug?: string | null): CartItem[] => {
  if (typeof window === 'undefined') return [];

  try {
    const item = window.localStorage.getItem(getStorefrontCartStorageKey(slug));
    const parsed = item ? JSON.parse(item) : [];

    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((entry: unknown): entry is Record<string, unknown> => {
        if (typeof entry !== 'object' || entry === null) return false;
        const item = entry as Record<string, unknown>;
        return typeof item.id === 'string' && typeof item.name === 'string';
      })
      .map(
        (entry) =>
          ({
            ...entry,
            price:
              typeof entry.price === 'number' && !Number.isNaN(entry.price)
                ? entry.price
                : Number(entry.price) || 0,
            quantity:
              typeof entry.quantity === 'number' &&
              !Number.isNaN(entry.quantity)
                ? entry.quantity
                : Number(entry.quantity) || 1,
          }) as CartItem
      );
  } catch (error) {
    logger.error({
      message: 'Failed to read cart from localStorage',
      error: error as Error,
    });
    return [];
  }
};

export const saveCartToStorage = (cart: CartItem[], slug?: string | null) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(
      getStorefrontCartStorageKey(slug),
      JSON.stringify(cart)
    );
  } catch (error) {
    logger.error({
      message: 'Failed to save cart to localStorage',
      error: error as Error,
    });
  }
};

export const getMerchantSlugFromStorage = (): string | null => {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage.getItem(MERCHANT_SLUG_KEY);
  } catch {
    return null;
  }
};

export const saveMerchantSlugToStorage = (slug: string | null) => {
  if (typeof window === 'undefined') return;

  try {
    if (slug) {
      window.localStorage.setItem(MERCHANT_SLUG_KEY, slug);
      return;
    }

    window.localStorage.removeItem(MERCHANT_SLUG_KEY);
  } catch (error) {
    logger.error({
      message: 'Failed to save merchant slug',
      error: error as Error,
    });
  }
};
