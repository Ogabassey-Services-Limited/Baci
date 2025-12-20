/**
 * Shopping Cart Store using Zustand
 * Manages shopping cart state with MMKV persistence
 * Updated for react-native-mmkv v4 API (2025)
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createMMKV, type MMKV } from 'react-native-mmkv';

// Initialize MMKV storage (v4 API uses createMMKV)
let storage: MMKV | null = null;

const getStorage = (): MMKV => {
  if (!storage) {
    storage = createMMKV({ id: 'ogabassey-cart' });
  }
  return storage;
};

// Custom storage adapter for Zustand persist
const mmkvStorage = {
  getItem: (name: string) => {
    const value = getStorage().getString(name);
    return value ?? null;
  },
  setItem: (name: string, value: string) => {
    getStorage().set(name, value);
  },
  removeItem: (name: string) => {
    getStorage().remove(name);
  },
};

export interface CartItem {
  id: string;
  product_id: string;
  variant_id?: string;
  name: string;
  price: number;
  compare_at_price?: number;
  quantity: number;
  image_url?: string;
  variant_name?: string;
  color?: string;
  storage?: string;
  condition?: string;
  max_quantity?: number;
}

interface CartState {
  // State
  items: CartItem[];
  isLoading: boolean;

  // Computed (via getters)
  itemCount: () => number;
  subtotal: () => number;
  totalSavings: () => number;

  // Actions
  addItem: (item: Omit<CartItem, 'id'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  getItem: (productId: string, variantId?: string) => CartItem | undefined;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      // Initial state
      items: [],
      isLoading: false,

      // Computed values
      itemCount: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0);
      },

      subtotal: () => {
        return get().items.reduce((total, item) => total + item.price * item.quantity, 0);
      },

      totalSavings: () => {
        return get().items.reduce((total, item) => {
          if (item.compare_at_price && item.compare_at_price > item.price) {
            return total + (item.compare_at_price - item.price) * item.quantity;
          }
          return total;
        }, 0);
      },

      // Add item to cart
      addItem: (item) => {
        set((state) => {
          // Check if item already exists (same product + variant)
          const existingIndex = state.items.findIndex(
            (i) => i.product_id === item.product_id && i.variant_id === item.variant_id
          );

          if (existingIndex >= 0) {
            // Update quantity
            const updatedItems = [...state.items];
            const existingItem = updatedItems[existingIndex];
            const newQuantity = existingItem.quantity + item.quantity;

            // Respect max quantity if set
            updatedItems[existingIndex] = {
              ...existingItem,
              quantity: existingItem.max_quantity
                ? Math.min(newQuantity, existingItem.max_quantity)
                : newQuantity,
            };

            return { items: updatedItems };
          }

          // Add new item
          const newItem: CartItem = {
            ...item,
            id: `${item.product_id}-${item.variant_id || 'default'}-${Date.now()}`,
          };

          return { items: [...state.items, newItem] };
        });
      },

      // Remove item from cart
      removeItem: (id) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        }));
      },

      // Update item quantity
      updateQuantity: (id, quantity) => {
        set((state) => {
          if (quantity <= 0) {
            return { items: state.items.filter((item) => item.id !== id) };
          }

          return {
            items: state.items.map((item) => {
              if (item.id !== id) return item;

              // Respect max quantity if set
              const newQuantity = item.max_quantity
                ? Math.min(quantity, item.max_quantity)
                : quantity;

              return { ...item, quantity: newQuantity };
            }),
          };
        });
      },

      // Clear all items
      clearCart: () => {
        set({ items: [] });
      },

      // Get specific item
      getItem: (productId, variantId) => {
        return get().items.find(
          (item) => item.product_id === productId && item.variant_id === variantId
        );
      },
    }),
    {
      name: 'cart-storage',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({ items: state.items }), // Only persist items
    }
  )
);

/**
 * Format price in Naira
 */
export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
