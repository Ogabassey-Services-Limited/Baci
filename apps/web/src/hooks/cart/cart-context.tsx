'use client';

import { createContext, useContext } from 'react';
import type { CartContextType } from './cart-types';

export const CartContext = createContext<CartContextType | undefined>(
  undefined
);

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export const useCartSafe = (): CartContextType | null => {
  return useContext(CartContext) ?? null;
};
