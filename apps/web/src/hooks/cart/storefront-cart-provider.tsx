'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { logger } from '@/lib/logger';
import type { Product } from '@/lib/products';
import { resolveDefaultVariantSelection } from '../../../../../packages/shared/src/lib/product-default-variant';
import { CartContext } from './cart-context';
import {
  DEFAULT_ASSURANCE_RATE,
  DEFAULT_DEFERRED_VALIDATION_TIMEOUT_MS,
  generateCartItemId,
  getCartFromStorage,
  getMerchantSlugFromStorage,
  saveCartToStorage,
  saveMerchantSlugToStorage,
} from './cart-storage';
import type { AddToCartOptions, CartContextType, CartItem } from './cart-types';
import {
  applyValidationResults,
  createCartHash,
  validateStorefrontCart,
} from './storefront-cart-validation';

interface StorefrontCartProviderProps {
  children: ReactNode;
  enableSmartCartPro?: boolean;
  merchantSlug?: string | null;
  deferValidationUntilIdle?: boolean;
  validationActivationTimeoutMs?: number;
}

export function StorefrontCartProvider({
  children,
  enableSmartCartPro = false,
  merchantSlug: initialMerchantSlug = null,
  deferValidationUntilIdle = false,
  validationActivationTimeoutMs = DEFAULT_DEFERRED_VALIDATION_TIMEOUT_MS,
}: StorefrontCartProviderProps) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [merchantSlug, setMerchantSlugState] = useState<string | null>(
    initialMerchantSlug
  );
  const [isHydrated, setIsHydrated] = useState(false);
  const [isValidationActivated, setIsValidationActivated] = useState(
    !deferValidationUntilIdle
  );
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [lastAddedProduct, setLastAddedProduct] = useState<Product | null>(
    null
  );
  const [showUpsell, setShowUpsell] = useState(false);
  const upsellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastValidatedCartHashRef = useRef('');

  useEffect(() => {
    const slugToUse = initialMerchantSlug || getMerchantSlugFromStorage();
    setCart(getCartFromStorage(slugToUse));
    setMerchantSlugState(slugToUse);
    setIsHydrated(true);
  }, [initialMerchantSlug]);

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
      if (cancelled || idleCallbackId !== undefined) return;

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
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);

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

  useEffect(() => {
    if (!isHydrated || !isValidationActivated || cart.length === 0) return;

    const cartHash = createCartHash(cart);
    if (cartHash === lastValidatedCartHashRef.current) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      lastValidatedCartHashRef.current = cartHash;

      try {
        const validation = await validateStorefrontCart(
          cart,
          controller.signal
        );
        if (!validation || controller.signal.aborted) {
          return;
        }

        setCart((previousCart) => {
          const updatedCart = applyValidationResults(previousCart, validation);
          lastValidatedCartHashRef.current = createCartHash(updatedCart);
          return updatedCart;
        });
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }

        logger.error({
          message: 'Cart validation error',
          error: error as Error,
        });
      }
    }, 500);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [cart, isHydrated, isValidationActivated]);

  useEffect(() => {
    if (isHydrated) {
      saveCartToStorage(cart, merchantSlug);
    }
  }, [cart, isHydrated, merchantSlug]);

  useEffect(() => {
    return () => {
      if (upsellTimerRef.current) {
        clearTimeout(upsellTimerRef.current);
      }
    };
  }, []);

  const addToCart = (
    product: Product,
    quantity = 1,
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

    if (productForCart.manage_stock && (productForCart.stock ?? 0) <= 0) {
      logger.warn({
        message: 'Attempted to add out-of-stock product to cart',
        productId: productForCart.id,
        productName: productForCart.name,
        stock: productForCart.stock,
      });
      return;
    }

    if (product.has_variants && !normalizedOptions?.variantId) {
      logger.warn({
        message: 'Attempted to add variant product without selecting variant',
        productId: productForCart.id,
        productName: productForCart.name,
      });
      return;
    }

    setCart((previousCart) => {
      const cartItemId = generateCartItemId(
        productForCart.id,
        normalizedOptions
      );
      const existingIndex = previousCart.findIndex((item) => {
        if (item.cartItemId === cartItemId) return true;
        if (item.id !== product.id) return false;
        if (item.variantId !== normalizedOptions?.variantId) return false;
        if (normalizedOptions?.color || normalizedOptions?.storage)
          return false;
        return !item.cartItemId;
      });

      if (existingIndex >= 0) {
        const nextCart = [...previousCart];
        const existingItem = nextCart[existingIndex];
        nextCart[existingIndex] = {
          ...existingItem,
          quantity: existingItem.quantity + quantity,
          cartItemId: existingItem.cartItemId || cartItemId,
        };
        return nextCart;
      }

      return [
        ...previousCart,
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
    setCart((previousCart) =>
      previousCart.filter((item) => {
        if (variantId) {
          return !(
            item.id === cartItemIdOrProductId && item.variantId === variantId
          );
        }

        if (item.cartItemId && item.cartItemId === cartItemIdOrProductId) {
          return false;
        }

        return !(item.id === cartItemIdOrProductId && !item.variantId);
      })
    );
  };

  const updateQuantity = (
    cartItemIdOrProductId: string,
    quantity: number,
    variantId?: string
  ) => {
    setCart((previousCart) => {
      const targetIndex = previousCart.findIndex((item) => {
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

      if (targetIndex === -1) return previousCart;
      if (quantity <= 0) {
        return previousCart.filter((_, index) => index !== targetIndex);
      }

      const nextCart = [...previousCart];
      const item = nextCart[targetIndex];
      const minimumOrderQuantity = item.minimum_order_quantity || 1;
      nextCart[targetIndex] = {
        ...item,
        quantity:
          quantity < minimumOrderQuantity ? minimumOrderQuantity : quantity,
      };
      return nextCart;
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

  const applyNegotiatedPrice = (cartItemId: string, newPrice: number) => {
    if (!enableSmartCartPro) return;
    setCart((previousCart) =>
      previousCart.map((item) =>
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
    setCart((previousCart) =>
      previousCart.map((item) => ({
        ...item,
        negotiatedPrice: (item.negotiatedPrice ?? item.price) * ratio,
        negotiationStatus: 'accepted',
      }))
    );
  };

  const toggleAssurance = (cartItemId: string) => {
    if (!enableSmartCartPro) return;
    setCart((previousCart) =>
      previousCart.map((item) =>
        item.cartItemId === cartItemId
          ? { ...item, hasAssurance: !item.hasAssurance }
          : item
      )
    );
  };

  const dismissUpsell = () => {
    setShowUpsell(false);
  };

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  const cartTotal = cart.reduce((total, item) => {
    const itemPrice = item.negotiatedPrice ?? item.price;
    const itemTotal = itemPrice * item.quantity;
    const assuranceCost = item.hasAssurance
      ? itemTotal * (item.assuranceRate ?? DEFAULT_ASSURANCE_RATE)
      : 0;
    return total + itemTotal + assuranceCost;
  }, 0);

  const value: CartContextType = {
    cart,
    merchantSlug,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    setMerchantSlug,
    cartCount,
    cartTotal,
    totalItems: cartCount,
    subtotal: cartTotal,
    isCartOpen,
    setIsCartOpen,
    applyNegotiatedPrice: enableSmartCartPro ? applyNegotiatedPrice : undefined,
    applyCartWideNegotiation: enableSmartCartPro
      ? applyCartWideNegotiation
      : undefined,
    toggleAssurance: enableSmartCartPro ? toggleAssurance : undefined,
    lastAddedProduct,
    showUpsell: enableSmartCartPro ? showUpsell : false,
    dismissUpsell,
    hasSmartCartPro: enableSmartCartPro,
    isHydrated,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
