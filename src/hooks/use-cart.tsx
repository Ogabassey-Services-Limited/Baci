
'use client';

import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { logger } from '@/lib/logger';
import { Product } from '@/lib/products';

// Define the shape of a cart item, which can have a quantity
interface CartItem extends Product {
  quantity: number;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  cartCount: number;
  cartTotal: number;
}

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

  const addToCart = useCallback((product: Product) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === product.id);
      if (existingItem) {
        // If item already exists, increment its quantity
        return prevCart.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      // Otherwise, add the new item with quantity 1
      return [...prevCart, { ...product, quantity: 1 }];
    });
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.id === productId ? { ...item, quantity } : item
      )
    );
  }, [removeFromCart]);

  const clearCart = useCallback(() => {
    setCart([]);
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
