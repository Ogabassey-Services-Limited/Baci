'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { CartContext, useCart, useCartSafe } from '@/hooks/cart/cart-context';
import type {
  AddToCartOptions,
  CartContextType,
  CartItem,
} from '@/hooks/cart/cart-types';
import { logger } from '@/lib/logger';
import type { Product } from '@/lib/products';
import { resolveDefaultVariantSelection } from '../../../../packages/shared/src/lib/product-default-variant';

// ============================================================================
// HELPERS
// ============================================================================

const CART_STORAGE_KEY = 'baci-cart';
const GUEST_CART_SUFFIX = 'guest';
const DEFAULT_DEFERRED_VALIDATION_TIMEOUT_MS = 2500;
/**
 * Get cart storage key namespaced by merchant and optionally by user ID
 * 2026 Best Practice: Separate guest carts from authenticated user carts
 * to prevent cart data leakage between users on shared devices
 */
const getCartStorageKey = (slug?: string | null, userId?: string | null) => {
  const userSuffix = userId || GUEST_CART_SUFFIX;
  return slug
    ? `${CART_STORAGE_KEY}-${slug}-${userSuffix}`
    : `${CART_STORAGE_KEY}-${userSuffix}`;
};
const MERCHANT_SLUG_KEY = 'baci-cart-merchant-slug';
const DEFAULT_ASSURANCE_RATE = 0.05; // 5%

/**
 * Clear cart from localStorage. Can be called outside React context.
 * Used for logout to prevent cart data leakage between users.
 * 2026 Best Practice: Clears both user-specific and guest carts
 */
export const clearCartStorage = (
  merchantSlug?: string | null,
  userId?: string | null
): void => {
  if (typeof window === 'undefined') return;
  try {
    // Clear cart for specific merchant + user combination
    if (merchantSlug) {
      window.localStorage.removeItem(getCartStorageKey(merchantSlug, userId));
      // Also clear guest cart for this merchant (prevents stale guest data)
      window.localStorage.removeItem(
        getCartStorageKey(merchantSlug, GUEST_CART_SUFFIX)
      );
    }
    // Also clear the default cart keys (for legacy/fallback)
    window.localStorage.removeItem(CART_STORAGE_KEY);
    window.localStorage.removeItem(`${CART_STORAGE_KEY}-${GUEST_CART_SUFFIX}`);
  } catch (error) {
    console.error('Failed to clear cart from localStorage', error);
  }
};

const generateCartItemId = (
  productId: string,
  options?: AddToCartOptions
): string => {
  const parts = [productId];
  if (options?.variantId) parts.push(`variant=${options.variantId}`);
  if (options?.color) parts.push(`color=${options.color}`);
  if (options?.secondaryColor)
    parts.push(`secondaryColor=${options.secondaryColor}`);
  if (options?.condition) parts.push(`condition=${options.condition}`);

  // Include all extra attribute keys (sorted) for deterministic IDs.
  // This mirrors buildCartItemId's selectedAttributes handling.
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

const getCartFromStorage = (
  slug?: string | null,
  userId?: string | null
): CartItem[] => {
  if (typeof window === 'undefined') return [];
  try {
    const item = window.localStorage.getItem(getCartStorageKey(slug, userId));
    const parsed = item ? JSON.parse(item) : [];

    // Validate items structure to prevent NaN prices and ghost items
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((i: unknown): i is Record<string, unknown> => {
        if (typeof i !== 'object' || i === null) return false;
        const item = i as Record<string, unknown>;
        return typeof item.id === 'string' && typeof item.name === 'string';
      })
      .map(
        (i) =>
          ({
            ...i,
            price:
              typeof i.price === 'number' && !Number.isNaN(i.price)
                ? i.price
                : Number(i.price) || 0,
            quantity:
              typeof i.quantity === 'number' && !Number.isNaN(i.quantity)
                ? i.quantity
                : Number(i.quantity) || 1,
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

const saveCartToStorage = (
  cart: CartItem[],
  slug?: string | null,
  userId?: string | null
) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      getCartStorageKey(slug, userId),
      JSON.stringify(cart)
    );
  } catch (error) {
    logger.error({
      message: 'Failed to save cart to localStorage',
      error: error as Error,
    });
  }
};

const getMerchantSlugFromStorage = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(MERCHANT_SLUG_KEY);
  } catch {
    return null;
  }
};

const saveMerchantSlugToStorage = (slug: string | null) => {
  if (typeof window === 'undefined') return;
  try {
    if (slug) {
      window.localStorage.setItem(MERCHANT_SLUG_KEY, slug);
    } else {
      window.localStorage.removeItem(MERCHANT_SLUG_KEY);
    }
  } catch (error) {
    logger.error({
      message: 'Failed to save merchant slug',
      error: error as Error,
    });
  }
};

interface CartProviderProps {
  children: ReactNode;
  /** Enable Smart Cart Pro features (price negotiation, assurance, upsells) */
  enableSmartCartPro?: boolean;
  /** Initial merchant slug to scope the cart */
  merchantSlug?: string | null;
  /** User ID to scope cart to authenticated user (prevents guest cart leakage) */
  userId?: string | null;
  /** Defer background validation until idle/interaction to keep startup lighter */
  deferValidationUntilIdle?: boolean;
  /** Fallback timeout when deferring validation activation */
  validationActivationTimeoutMs?: number;
}

/**
 * Unified Cart Provider
 *
 * Combines basic cart functionality with optional Smart Cart Pro features.
 * Smart Cart Pro features are only active when enableSmartCartPro is true.
 */
// Unified Cart Provider
export const CartProvider = ({
  children,
  enableSmartCartPro = false,
  merchantSlug: initialMerchantSlug = null,
  userId: initialUserId = null,
  deferValidationUntilIdle = false,
  validationActivationTimeoutMs = DEFAULT_DEFERRED_VALIDATION_TIMEOUT_MS,
}: CartProviderProps) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [merchantSlug, setMerchantSlugState] = useState<string | null>(
    initialMerchantSlug
  );
  const [userId, setUserId] = useState<string | null>(initialUserId);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isValidationActivated, setIsValidationActivated] = useState(
    !deferValidationUntilIdle
  );

  // Smart Cart Pro state
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [lastAddedProduct, setLastAddedProduct] = useState<Product | null>(
    null
  );
  const [showUpsell, setShowUpsell] = useState(false);
  const upsellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 2026 Critical Fix: Track validation state to prevent infinite loops
  const lastValidatedCartHashRef = useRef<string>('');

  // Hydrate from localStorage
  useEffect(() => {
    const slugToUse = initialMerchantSlug || getMerchantSlugFromStorage();
    setCart(getCartFromStorage(slugToUse, initialUserId));
    setMerchantSlugState(slugToUse);
    setUserId(initialUserId);
    setIsHydrated(true);
  }, [initialMerchantSlug, initialUserId]);

  useEffect(() => {
    if (!deferValidationUntilIdle) {
      setIsValidationActivated(true);
      return;
    }

    if (isValidationActivated) {
      return;
    }

    let cancelled = false;
    let idleCallbackId: number | undefined;
    let loadListenerAttached = false;
    const activateValidation = () => {
      if (!cancelled) {
        setIsValidationActivated(true);
      }
    };

    const scheduleIdleActivation = () => {
      if (cancelled || idleCallbackId !== undefined) {
        return;
      }

      if (typeof window.requestIdleCallback === 'function') {
        idleCallbackId = window.requestIdleCallback(activateValidation, {
          timeout: validationActivationTimeoutMs || 1000,
        });
        return;
      }

      idleCallbackId = window.setTimeout(activateValidation, 0);
    };

    const handleWindowLoad = () => {
      window.removeEventListener('load', handleWindowLoad);
      loadListenerAttached = false;
      scheduleIdleActivation();
    };

    const timeoutId =
      validationActivationTimeoutMs > 0
        ? window.setTimeout(activateValidation, validationActivationTimeoutMs)
        : undefined;

    if (document.readyState === 'complete') {
      scheduleIdleActivation();
    } else {
      loadListenerAttached = true;
      window.addEventListener('load', handleWindowLoad, { once: true });
    }

    window.addEventListener('pointerdown', activateValidation, {
      once: true,
      passive: true,
    });
    window.addEventListener('keydown', activateValidation, { once: true });
    window.addEventListener('scroll', activateValidation, {
      once: true,
      passive: true,
    });

    return () => {
      cancelled = true;

      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }

      if (idleCallbackId !== undefined) {
        if (typeof window.cancelIdleCallback === 'function') {
          window.cancelIdleCallback(idleCallbackId);
        } else {
          window.clearTimeout(idleCallbackId);
        }
      }

      if (loadListenerAttached) {
        window.removeEventListener('load', handleWindowLoad);
      }

      window.removeEventListener('pointerdown', activateValidation);
      window.removeEventListener('keydown', activateValidation);
      window.removeEventListener('scroll', activateValidation);
    };
  }, [
    deferValidationUntilIdle,
    isValidationActivated,
    validationActivationTimeoutMs,
  ]);

  // Background validation: Remove ghost products and update stale prices
  useEffect(() => {
    if (!isHydrated || !isValidationActivated || cart.length === 0) return;

    // 2026 Critical Fix: Create a stable hash of cart item IDs+prices to detect meaningful changes
    // This prevents infinite loops when validation updates prices
    const cartHash = cart
      .map((item) => `${item.id}:${item.price}`)
      .sort()
      .join('|');

    // Skip if already validating or cart hasn't meaningfully changed
    if (cartHash === lastValidatedCartHashRef.current) {
      return;
    }

    const controller = new AbortController();

    const validateCart = async () => {
      // 2026 Critical Fix: Set validation lock
      lastValidatedCartHashRef.current = cartHash;

      // Limit batch size to prevent massive payloads
      const BATCH_SIZE = 50;
      const limitedCart = cart.slice(0, BATCH_SIZE);

      try {
        const cartItems = limitedCart.map((item) => ({
          id: item.id,
          price: item.price,
        }));

        const response = await fetch('/api/cart/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cartItems }),
          signal: controller.signal,
        });

        if (!response.ok) {
          logger.warn({
            message: 'Cart validation failed',
            status: response.status,
          });
          return;
        }

        const { invalidProductIds, priceChanges } = (await response.json()) as {
          invalidProductIds: string[];
          priceChanges: { id: string; oldPrice: number; newPrice: number }[];
        };

        // OPTIMIZATION: Use Set for O(1) lookup to remove ghost products
        const invalidIdsSet = new Set(invalidProductIds || []);

        // 2026 Critical Fix: Only update if there are actual changes
        const hasInvalidProducts = invalidIdsSet.size > 0;
        const hasPriceChanges = priceChanges?.length > 0;

        if (hasInvalidProducts || hasPriceChanges) {
          // Check if aborted before applying state
          if (controller.signal.aborted) return;

          setCart((prev) => {
            let updated = prev;

            // Remove ghost products
            if (hasInvalidProducts) {
              updated = updated.filter((item) => !invalidIdsSet.has(item.id));
              if (updated.length !== prev.length) {
                logger.info({
                  message: 'Removed ghost products from cart',
                  count: prev.length - updated.length,
                  removedIds: invalidProductIds,
                });
              }
            }

            // Update stale prices
            if (hasPriceChanges) {
              const priceChangesMap = new Map(
                priceChanges.map((pc) => [pc.id, pc])
              );
              updated = updated.map((item) => {
                const priceChange = priceChangesMap.get(item.id);
                if (priceChange) {
                  logger.info({
                    message: 'Updated stale price in cart',
                    productId: item.id,
                    oldPrice: priceChange.oldPrice,
                    newPrice: priceChange.newPrice,
                  });
                  return { ...item, price: priceChange.newPrice };
                }
                return item;
              });
            }

            // 2026 Critical Fix: Update the hash ref AFTER cart changes
            // to prevent re-validation of the same corrected cart
            const newHash = updated
              .map((item) => `${item.id}:${item.price}`)
              .sort()
              .join('|');
            lastValidatedCartHashRef.current = newHash;

            return updated;
          });
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          // Expected on cleanup/cancel
        } else {
          logger.error({
            message: 'Cart validation error',
            error: error as Error,
          });
        }
      }
    };

    // Run validation after a short delay to not block initial render
    const timer = setTimeout(validateCart, 500);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [isHydrated, isValidationActivated, cart]);

  // Persist to localStorage
  useEffect(() => {
    if (isHydrated) {
      saveCartToStorage(cart, merchantSlug, userId);
    }
  }, [cart, isHydrated, merchantSlug, userId]);

  // Cleanup upsell timer on unmount
  useEffect(() => {
    return () => {
      if (upsellTimerRef.current) {
        clearTimeout(upsellTimerRef.current);
      }
    };
  }, []);

  // ========== BASIC CART OPERATIONS ==========

  const addToCart = (
    product: Product,
    quantity: number = 1,
    options?: AddToCartOptions
  ) => {
    const defaultVariantSelection =
      product.has_variants && !options?.variantId
        ? resolveDefaultVariantSelection(product)
        : null;
    const normalizedOptions =
      defaultVariantSelection && !options?.variantId
        ? {
            ...options,
            variantId: defaultVariantSelection.variant.id,
            variantAttributes: defaultVariantSelection.attributes,
            color: options?.color ?? defaultVariantSelection.color,
            storage: options?.storage ?? defaultVariantSelection.storage,
          }
        : options;
    const productForCart =
      defaultVariantSelection && !options?.variantId
        ? {
            ...product,
            price: defaultVariantSelection.price,
            compare_at_price:
              defaultVariantSelection.compareAtPrice ??
              product.compare_at_price,
            stock:
              defaultVariantSelection.variant.stock_quantity ?? product.stock,
          }
        : product;

    // Stock validation: Prevent adding out-of-stock items
    if (productForCart.manage_stock && (productForCart.stock ?? 0) <= 0) {
      logger.warn({
        message: 'Attempted to add out-of-stock product to cart',
        productId: productForCart.id,
        productName: productForCart.name,
        stock: productForCart.stock,
      });
      return; // Silently reject - UI should show out of stock state
    }

    // Variant validation: Prevent adding variant products without selection
    if (product.has_variants && !normalizedOptions?.variantId) {
      logger.warn({
        message: 'Attempted to add variant product without selecting variant',
        productId: productForCart.id,
        productName: productForCart.name,
      });
      return;
    }

    setCart((prev) => {
      const cartItemId = generateCartItemId(
        productForCart.id,
        normalizedOptions
      );

      // Robust duplicate check: Match by cartItemId OR Legacy ID/Variant
      const existingItemIndex = prev.findIndex((item) => {
        // 1. Direct V2 Match (:: separator)
        if (item.cartItemId === cartItemId) return true;

        // 2. Legacy V1 Match (old - separator format stored in cart)
        if (item.cartItemId?.includes('-') && !item.cartItemId.includes('::')) {
          // Rebuild what the old generateCartItemId would have produced
          const legacyParts = [product.id];
          if (options?.variantId) legacyParts.push(options.variantId);
          if (options?.color) legacyParts.push(options.color);
          if (options?.storage) legacyParts.push(options.storage);
          if (options?.condition) legacyParts.push(options.condition);
          if (item.cartItemId === legacyParts.join('-')) return true;
        }

        // 3. Legacy Match (if item has no cartItemId)
        if (!item.cartItemId && item.id === product.id) {
          const itemVar = item.variantId;
          const newVar = normalizedOptions?.variantId;
          if (itemVar !== newVar) return false;

          // Check if V2 options are used (legacy items have none)
          // If adding item with V2 options, don't match legacy item
          if (normalizedOptions?.color || normalizedOptions?.storage)
            return false;

          return true;
        }
        return false;
      });

      if (existingItemIndex >= 0) {
        // Update existing item
        const newCart = [...prev];
        const item = newCart[existingItemIndex];
        newCart[existingItemIndex] = {
          ...item,
          quantity: item.quantity + quantity,
          // Ensure cartItemId is set on legacy item upgrade
          cartItemId: item.cartItemId || cartItemId,
        };
        return newCart;
      }

      // Add new item
      return [
        ...prev,
        {
          ...productForCart,
          cartItemId,
          quantity,
          variantId: normalizedOptions?.variantId,
          variantAttributes: normalizedOptions?.variantAttributes,
          selectedColor: normalizedOptions?.color,
          selectedColorValue: normalizedOptions?.colorValue,
          secondaryColor: normalizedOptions?.secondaryColor,
          secondaryColorValue: normalizedOptions?.secondaryColorValue,
          selectedStorage: normalizedOptions?.storage,
          condition: normalizedOptions?.condition as
            | 'new'
            | 'used'
            | 'open_box'
            | 'refurbished'
            | undefined,
          negotiationStatus: 'none',
          hasAssurance: false,
          assuranceRate: DEFAULT_ASSURANCE_RATE,
        },
      ];
    });

    // Smart Cart Pro: Trigger upsell
    if (enableSmartCartPro) {
      setLastAddedProduct(productForCart);
      upsellTimerRef.current = setTimeout(() => {
        setShowUpsell(true);
      }, 500);
    }
  };

  const removeFromCart = (
    cartItemIdOrProductId: string,
    variantId?: string
  ) => {
    setCart((prev) =>
      prev.filter((item) => {
        // 1. If variantId provided (Platform style), strictly match ID + Variant
        if (variantId) {
          return !(
            item.id === cartItemIdOrProductId && item.variantId === variantId
          );
        }

        // 2. If no variantId provided...

        // Match by cartItemId (V2 style)
        if (item.cartItemId && item.cartItemId === cartItemIdOrProductId)
          return false;

        // Match by Product ID (Simple Product - Platform/Legacy style)
        // Only remove if item definitely has no variant
        if (item.id === cartItemIdOrProductId && !item.variantId) return false;

        return true;
      })
    );
  };

  const updateQuantity = (
    cartItemIdOrProductId: string,
    quantity: number,
    variantId?: string
  ) => {
    setCart((prev) => {
      // Find item logic matches removeFromCart logic
      const targetIndex = prev.findIndex((item) => {
        if (variantId) {
          return (
            item.id === cartItemIdOrProductId && item.variantId === variantId
          );
        }
        return (
          item.cartItemId === cartItemIdOrProductId ||
          (item.id === cartItemIdOrProductId && !item.variantId)
        );
      });

      if (targetIndex === -1) return prev;

      const item = prev[targetIndex];
      const moq = item.minimum_order_quantity || 1;

      // Logic: If q <= 0, remove. If q < moq, set to moq. Else set to q.
      // But if q=0 specifically, user probably clicked "Remove" or minus until 0.
      // Platform logic: if q < moq -> if q==0 remove, else set to moq.

      if (quantity <= 0) {
        // Return cart without this item
        return prev.filter((_, idx) => idx !== targetIndex);
      }

      let finalQuantity = quantity;
      if (quantity < moq) {
        finalQuantity = moq;
      }

      const newCart = [...prev];
      newCart[targetIndex] = { ...item, quantity: finalQuantity };
      return newCart;
    });
  };

  const clearCart = () => {
    setCart([]);
    setMerchantSlugState(null);
    saveMerchantSlugToStorage(null);
    logger.info({ message: 'Cart cleared' });
  };

  const setMerchantSlug = (slug: string) => {
    setMerchantSlugState(slug);
    saveMerchantSlugToStorage(slug);
  };

  // ========== SMART CART PRO: PRICE NEGOTIATION ==========

  const applyNegotiatedPrice = (cartItemId: string, newPrice: number) => {
    if (!enableSmartCartPro) return;
    setCart((prev) =>
      prev.map((item) =>
        item.cartItemId === cartItemId
          ? {
              ...item,
              negotiatedPrice: newPrice,
              negotiationStatus: 'accepted',
            }
          : item
      )
    );
  };

  const applyCartWideNegotiation = (newTotal: number) => {
    if (!enableSmartCartPro) return;

    const currentTotal = cart.reduce((sum, item) => {
      const price = item.negotiatedPrice ?? item.price;
      return sum + price * item.quantity;
    }, 0);

    if (currentTotal <= 0) return;
    const ratio = newTotal / currentTotal;

    setCart((prev) =>
      prev.map((item) => {
        const currentPrice = item.negotiatedPrice ?? item.price;
        return {
          ...item,
          negotiatedPrice: currentPrice * ratio,
          negotiationStatus: 'accepted',
        };
      })
    );
  };

  // ========== SMART CART PRO: DEVICE ASSURANCE ==========

  const toggleAssurance = (cartItemId: string) => {
    if (!enableSmartCartPro) return;
    setCart((prev) =>
      prev.map((item) =>
        item.cartItemId === cartItemId
          ? { ...item, hasAssurance: !item.hasAssurance }
          : item
      )
    );
  };

  // ========== SMART CART PRO: UPSELL ==========

  const dismissUpsell = () => {
    setShowUpsell(false);
  };

  // ========== COMPUTED VALUES ==========

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);

  const cartTotal = (() => {
    try {
      return cart.reduce((total, item) => {
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
          ? itemTotal * (item.assuranceRate ?? DEFAULT_ASSURANCE_RATE)
          : 0;
        return total + itemTotal + assuranceCost;
      }, 0);
    } catch (e) {
      console.error('Error calculating cartTotal:', e);
      return 0;
    }
  })();

  // Aliases for V2 compatibility
  const totalItems = cartCount;
  const subtotal = cartTotal;

  // ========== CONTEXT VALUE ==========

  const value: CartContextType = {
    // Basic
    cart,
    merchantSlug,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    setMerchantSlug,
    cartCount,
    cartTotal,
    totalItems,
    subtotal,

    // Smart Cart Pro: Cart UI
    isCartOpen,
    setIsCartOpen,

    // Smart Cart Pro: Negotiation (only if enabled)
    applyNegotiatedPrice: enableSmartCartPro ? applyNegotiatedPrice : undefined,
    applyCartWideNegotiation: enableSmartCartPro
      ? applyCartWideNegotiation
      : undefined,

    // Smart Cart Pro: Assurance (only if enabled)
    toggleAssurance: enableSmartCartPro ? toggleAssurance : undefined,

    // Smart Cart Pro: Upsell
    lastAddedProduct,
    showUpsell: enableSmartCartPro ? showUpsell : false,
    dismissUpsell,

    // Feature flag
    hasSmartCartPro: enableSmartCartPro,

    // Hydration state
    isHydrated,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export type { CartContextType, CartItem };
export { useCart, useCartSafe };
