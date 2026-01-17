'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { logger } from '@/lib/logger';
import type { Product } from '@/lib/products';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Extended cart item with support for:
 * - Basic cart (quantity, variants)
 * - Smart Cart Pro (negotiation, assurance)
 */
export interface CartItem extends Product {
  quantity: number;
  variantId?: string;
  variantAttributes?: Record<string, string>;
  cartItemId: string; // Unique identifier for this cart entry

  // Smart Cart Pro: Color/Storage selection
  selectedColor?: string;
  selectedColorValue?: string;
  secondaryColor?: string;
  secondaryColorValue?: string;
  selectedStorage?: string;
  condition?: 'new' | 'used' | 'open_box' | 'refurbished';

  // Smart Cart Pro: Price Negotiation
  negotiatedPrice?: number;
  negotiationStatus?: 'none' | 'pending' | 'accepted' | 'rejected';

  // Smart Cart Pro: Device Assurance
  hasAssurance?: boolean;
  assuranceRate?: number; // Percentage, default 5%
}

interface AddToCartOptions {
  variantId?: string;
  variantAttributes?: Record<string, string>;
  // Smart Cart Pro options
  color?: string;
  colorValue?: string;
  secondaryColor?: string;
  secondaryColorValue?: string;
  storage?: string;
  condition?: string;
  platform?: string; // Phase 4 Extension
}

export interface CartContextType {
  // Basic cart operations
  cart: CartItem[];
  merchantSlug: string | null;
  addToCart: (
    product: Product,
    quantity?: number,
    options?: AddToCartOptions
  ) => void;
  removeFromCart: (cartItemIdOrProductId: string, variantId?: string) => void;
  updateQuantity: (
    cartItemIdOrProductId: string,
    quantity: number,
    variantId?: string
  ) => void;
  clearCart: () => void;
  setMerchantSlug: (slug: string) => void;

  // Computed values
  cartCount: number;
  cartTotal: number;
  totalItems: number;
  subtotal: number;

  // Smart Cart Pro: Cart UI state
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;

  // Smart Cart Pro: Price Negotiation
  applyNegotiatedPrice?: (cartItemId: string, newPrice: number) => void;
  applyCartWideNegotiation?: (newTotal: number) => void;

  // Smart Cart Pro: Device Assurance
  toggleAssurance?: (cartItemId: string) => void;

  // Smart Cart Pro: Upsell
  lastAddedProduct: Product | null;
  showUpsell: boolean;
  dismissUpsell: () => void;

  // Feature availability
  hasSmartCartPro: boolean;

  // Hydration state - true once cart has loaded from localStorage
  isHydrated: boolean;
}

// ============================================================================
// HELPERS
// ============================================================================

const CART_STORAGE_KEY = 'baci-cart';
const getCartStorageKey = (slug?: string | null) =>
  slug ? `${CART_STORAGE_KEY}-${slug}` : CART_STORAGE_KEY;
const MERCHANT_SLUG_KEY = 'baci-cart-merchant-slug';
const DEFAULT_ASSURANCE_RATE = 0.05; // 5%

const generateCartItemId = (
  productId: string,
  options?: AddToCartOptions
): string => {
  const parts = [productId];
  if (options?.variantId) parts.push(options.variantId);
  if (options?.color) parts.push(options.color);
  if (options?.storage) parts.push(options.storage);
  if (options?.condition) parts.push(options.condition);
  return parts.join('-');
};

const getCartFromStorage = (slug?: string | null): CartItem[] => {
  if (typeof window === 'undefined') return [];
  try {
    const item = window.localStorage.getItem(getCartStorageKey(slug));
    const parsed = item ? JSON.parse(item) : [];

    // Validate items structure to prevent NaN prices and ghost items
    if (!Array.isArray(parsed)) return [];

    return (
      parsed
        .filter((i: unknown) => {
          const item = i as Partial<CartItem>;
          // Must have valid ID and Name
          if (!item.id || !item.name) return false;
          return true;
        })
        // biome-ignore lint/suspicious/noExplicitAny: Safely casting unknown to CartItem
        .map((i: any) => ({
          ...i,
          // Ensure price is a number
          price: typeof i.price === 'number' ? i.price : Number(i.price) || 0,
          quantity:
            typeof i.quantity === 'number'
              ? i.quantity
              : Number(i.quantity) || 1,
        })) as CartItem[]
    );
  } catch (error) {
    logger.error({
      message: 'Failed to read cart from localStorage',
      error: error as Error,
    });
    return [];
  }
};

const saveCartToStorage = (cart: CartItem[], slug?: string | null) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(getCartStorageKey(slug), JSON.stringify(cart));
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

// ============================================================================
// CONTEXT
// ============================================================================

const CartContext = createContext<CartContextType | undefined>(undefined);

interface CartProviderProps {
  children: ReactNode;
  /** Enable Smart Cart Pro features (price negotiation, assurance, upsells) */
  enableSmartCartPro?: boolean;
  /** Initial merchant slug to scope the cart */
  merchantSlug?: string | null;
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
}: CartProviderProps) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [merchantSlug, setMerchantSlugState] = useState<string | null>(
    initialMerchantSlug
  );
  const [isHydrated, setIsHydrated] = useState(false);

  // Smart Cart Pro state
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [lastAddedProduct, setLastAddedProduct] = useState<Product | null>(
    null
  );
  const [showUpsell, setShowUpsell] = useState(false);
  const upsellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate from localStorage
  useEffect(() => {
    const slugToUse = initialMerchantSlug || getMerchantSlugFromStorage();
    setCart(getCartFromStorage(slugToUse));
    setMerchantSlugState(slugToUse);
    setIsHydrated(true);
  }, [initialMerchantSlug]);

  // Background validation: Remove ghost products and update stale prices
  useEffect(() => {
    if (!isHydrated || cart.length === 0) return;

    // Use a ref to access current cart state inside the effect without triggering re-runs on every item change
    // We only want to run validation when hydration completes or potentially when significantly changed (e.g. length)
    // But to follow lint rules strictly, we can use a ref or stable callback.
    // However, the intention IS to debounce and not run on every keypress/update.
    const validateCart = async () => {
      // Limit batch size to prevent massive payloads
      const BATCH_SIZE = 50;
      const limitedCart = cart.slice(0, BATCH_SIZE);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

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

        // Remove invalid products (ghost products)
        if (invalidProductIds?.length > 0) {
          setCart((prev) => {
            const filtered = prev.filter(
              (item) => !invalidProductIds.includes(item.id)
            );
            if (filtered.length !== prev.length) {
              logger.info({
                message: 'Removed ghost products from cart',
                count: prev.length - filtered.length,
                removedIds: invalidProductIds,
              });
            }
            return filtered;
          });
        }

        // Update stale prices
        if (priceChanges?.length > 0) {
          setCart((prev) =>
            prev.map((item) => {
              const priceChange = priceChanges.find((pc) => pc.id === item.id);
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
            })
          );
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          logger.warn({ message: 'Cart validation timed out' });
        } else {
          logger.error({
            message: 'Cart validation error',
            error: error as Error,
          });
        }
      } finally {
        clearTimeout(timeoutId);
      }
    };

    // Run validation after a short delay to not block initial render
    const timer = setTimeout(validateCart, 500);
    return () => clearTimeout(timer);
  }, [isHydrated, cart]); // Include cart as dependency, but effect logic relies on timeout debounce to be "safe enough".

  // Persist to localStorage
  useEffect(() => {
    if (isHydrated) {
      saveCartToStorage(cart, merchantSlug);
    }
  }, [cart, isHydrated, merchantSlug]);

  // Cleanup upsell timer on unmount
  useEffect(() => {
    return () => {
      if (upsellTimerRef.current) {
        clearTimeout(upsellTimerRef.current);
      }
    };
  }, []);

  // ========== BASIC CART OPERATIONS ==========

  const addToCart = useCallback(
    (product: Product, quantity: number = 1, options?: AddToCartOptions) => {
      setCart((prev) => {
        const cartItemId = generateCartItemId(product.id, options);

        // Robust duplicate check: Match by cartItemId OR Legacy ID/Variant
        const existingItemIndex = prev.findIndex((item) => {
          // 1. Direct V2 Match
          if (item.cartItemId === cartItemId) return true;

          // 2. Legacy Match (if item has no cartItemId)
          if (!item.cartItemId && item.id === product.id) {
            const itemVar = item.variantId;
            const newVar = options?.variantId;
            if (itemVar !== newVar) return false;

            // Check if V2 options are used (legacy items have none)
            // If adding item with V2 options, don't match legacy item
            if (options?.color || options?.storage) return false;

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
            ...product,
            cartItemId,
            quantity,
            variantId: options?.variantId,
            variantAttributes: options?.variantAttributes,
            selectedColor: options?.color,
            selectedColorValue: options?.colorValue,
            secondaryColor: options?.secondaryColor,
            secondaryColorValue: options?.secondaryColorValue,
            selectedStorage: options?.storage,
            condition: options?.condition as
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
        setLastAddedProduct(product);
        upsellTimerRef.current = setTimeout(() => {
          setShowUpsell(true);
        }, 500);
      }
    },
    [enableSmartCartPro]
  );

  const removeFromCart = useCallback(
    (cartItemIdOrProductId: string, variantId?: string) => {
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
          if (item.id === cartItemIdOrProductId && !item.variantId)
            return false;

          return true;
        })
      );
    },
    []
  );

  const updateQuantity = useCallback(
    (cartItemIdOrProductId: string, quantity: number, variantId?: string) => {
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
    },
    []
  );

  const clearCart = useCallback(() => {
    setCart([]);
    setMerchantSlugState(null);
    saveMerchantSlugToStorage(null);
    logger.info({ message: 'Cart cleared' });
  }, []);

  const setMerchantSlug = useCallback((slug: string) => {
    setMerchantSlugState(slug);
    saveMerchantSlugToStorage(slug);
  }, []);

  // ========== SMART CART PRO: PRICE NEGOTIATION ==========

  const applyNegotiatedPrice = useCallback(
    (cartItemId: string, newPrice: number) => {
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
    },
    [enableSmartCartPro]
  );

  const applyCartWideNegotiation = useCallback(
    (newTotal: number) => {
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
    },
    [cart, enableSmartCartPro]
  );

  // ========== SMART CART PRO: DEVICE ASSURANCE ==========

  const toggleAssurance = useCallback(
    (cartItemId: string) => {
      if (!enableSmartCartPro) return;
      setCart((prev) =>
        prev.map((item) =>
          item.cartItemId === cartItemId
            ? { ...item, hasAssurance: !item.hasAssurance }
            : item
        )
      );
    },
    [enableSmartCartPro]
  );

  // ========== SMART CART PRO: UPSELL ==========

  const dismissUpsell = useCallback(() => {
    setShowUpsell(false);
  }, []);

  // ========== COMPUTED VALUES ==========

  const cartCount = useMemo(
    () => cart.reduce((total, item) => total + item.quantity, 0),
    [cart]
  );

  const cartTotal = useMemo(() => {
    return cart.reduce((total, item) => {
      const price = item.negotiatedPrice ?? item.price;
      const itemTotal = price * item.quantity;
      const assuranceCost = item.hasAssurance
        ? itemTotal * (item.assuranceRate ?? DEFAULT_ASSURANCE_RATE)
        : 0;
      return total + itemTotal + assuranceCost;
    }, 0);
  }, [cart]);

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

// ============================================================================
// HOOK
// ============================================================================

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

/**
 * Safe version that returns null outside of provider
 * Useful for components that may be rendered outside cart context
 */
export const useCartSafe = (): CartContextType | null => {
  return useContext(CartContext) ?? null;
};
