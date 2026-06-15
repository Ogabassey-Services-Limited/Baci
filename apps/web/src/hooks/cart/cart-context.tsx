'use client';

import { createContext, use } from 'react';
import type { CartContextType } from './cart-types';

export const CartContext = createContext<CartContextType | undefined>(
  undefined
);

export const useCart = (): CartContextType => {
  const context = use(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export const useCartSafe = (): CartContextType | null => {
  return use(CartContext) ?? null;
};
