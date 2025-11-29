
'use client';

import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { logger } from '@/lib/logger';
import { Product } from '@/lib/products';

// Define the shape of a cart item, which can have a quantity and variant info
interface CartItem extends Product {
  quantity: number;
  variantId?: string;
  variantAttributes?: Record<string, string>;
}

// Options for adding to cart
interface AddToCartOptions {
  variantId?: string;
  variantAttributes?: Record<string, string>;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number, options?: AddToCartOptions) => void;
  removeFromCart: (productId: string, variantId?: string) => void;
  updateQuantity: (productId: string, quantity: number, variantId?: string) => void;
  clearCart: () => void;
  cartCount: number;
  cartTotal: number;
}

// Generate a unique key for cart items (productId + variantId if present)
const getCartItemKey = (productId: string, variantId?: string): string => {
  return variantId ? `${productId}:${variantId}` : productId;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

// Helper function to get cart from localStorage
const getCartFromStorage = (): CartItem[] => {
  try {
    const item = window.localStorage.getItem('baci-cart');
    return item ? JSON.parse(item) : [];
  } catch (error) {
    logger.error({ message: 'Failed to read cart from localStorage', error: error as Error });
    return [];
  }
};

// Helper function to save cart to localStorage
const saveCartToStorage = (cart: CartItem[]) => {
  try {
    window.localStorage.setItem('baci-cart', JSON.stringify(cart));
  } catch (error) {
    logger.error({ message: 'Failed to save cart to localStorage', error: error as Error });
  }
};

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [cart, setCart] = useState<CartItem[]>([]);

  useEffect(() => {
    // Load cart from localStorage on initial client-side render
    setCart(getCartFromStorage());
  }, []);

  useEffect(() => {
    // Save cart to localStorage whenever it changes
    saveCartToStorage(cart);
  }, [cart]);

  const addToCart = useCallback((product: Product, quantity: number = 1, options?: AddToCartOptions) => {
    setCart((prevCart) => {
      const variantId = options?.variantId;
      const variantAttributes = options?.variantAttributes;
      const itemKey = getCartItemKey(product.id, variantId);

      // Find existing item with same product AND variant
      const existingItem = prevCart.find((item) =>
        getCartItemKey(item.id, item.variantId) === itemKey
      );

      if (existingItem) {
        // If item already exists, increment its quantity
        return prevCart.map((item) =>
          getCartItemKey(item.id, item.variantId) === itemKey
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      // Otherwise, add the new item with the specified quantity and variant info
      return [...prevCart, {
        ...product,
        quantity,
        variantId,
        variantAttributes
      }];
    });
  }, []);

  const removeFromCart = useCallback((productId: string, variantId?: string) => {
    const itemKey = getCartItemKey(productId, variantId);
    setCart((prevCart) => prevCart.filter((item) =>
      getCartItemKey(item.id, item.variantId) !== itemKey
    ));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number, variantId?: string) => {
    const itemKey = getCartItemKey(productId, variantId);
    const product = cart.find(item => getCartItemKey(item.id, item.variantId) === itemKey);
    const moq = product?.minimum_order_quantity || 1;

    if (quantity < moq) {
      if (quantity === 0) {
        removeFromCart(productId, variantId);
      } else {
        // If trying to set below MOQ, reset to MOQ.
        setCart((prevCart) =>
          prevCart.map((item) =>
            getCartItemKey(item.id, item.variantId) === itemKey
              ? { ...item, quantity: moq }
              : item
          )
        );
      }
      return;
    }
    setCart((prevCart) =>
      prevCart.map((item) =>
        getCartItemKey(item.id, item.variantId) === itemKey
          ? { ...item, quantity }
          : item
      )
    );
  }, [cart, removeFromCart]);

  const clearCart = useCallback(() => {
    setCart([]);
    logger.info({ message: 'Cart cleared' });
  }, []);

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);

  const cartTotal = cart.reduce((total, item) => total + item.price * item.quantity, 0);

  const value = {
    cart,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    cartCount,
    cartTotal,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
