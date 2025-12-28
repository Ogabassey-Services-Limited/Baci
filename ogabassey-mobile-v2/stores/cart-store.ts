/**
 * Shopping Cart Store using Zustand
 * Manages shopping cart state with AsyncStorage persistence
 * Compatible with Expo Go (no native modules required)
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { syncStorage } from '../lib/storage';

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
  // Negotiation & Assurance fields
  negotiatedPrice?: number;
  hasAssurance?: boolean;
  negotiationStatus?: 'pending' | 'accepted' | 'rejected';
}

interface CartState {
  // State
  items: CartItem[];
  isLoading: boolean;
  cartDiscount: number; // Cart-wide negotiated discount

  // Computed (via getters)
  itemCount: () => number;
  subtotal: () => number;
  totalSavings: () => number;
  cartTotal: () => number;

  // Actions
  addItem: (item: Omit<CartItem, 'id'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  getItem: (productId: string, variantId?: string) => CartItem | undefined;
  // Negotiation & Assurance actions
  applyNegotiatedPrice: (id: string, price: number) => void;
  toggleAssurance: (id: string) => void;
  applyCartDiscount: (discountAmount: number) => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      // Initial state
      items: [],
      isLoading: false,
      cartDiscount: 0,

      // Computed values
      itemCount: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0);
      },

      subtotal: () => {
        return get().items.reduce((total, item) => {
          const price = item.negotiatedPrice ?? item.price;
          return total + price * item.quantity;
        }, 0);
      },

      totalSavings: () => {
        return get().items.reduce((total, item) => {
          if (item.compare_at_price && item.compare_at_price > item.price) {
            return total + (item.compare_at_price - item.price) * item.quantity;
          }
          return total;
        }, 0);
      },

      cartTotal: () => {
        const items = get().items;
        const subtotal = items.reduce((total, item) => {
          const price = item.negotiatedPrice ?? item.price;
          return total + price * item.quantity;
        }, 0);
        const assurance = items.reduce((total, item) => {
          if (item.hasAssurance) {
            const price = item.negotiatedPrice ?? item.price;
            return total + price * item.quantity * 0.05;
          }
          return total;
        }, 0);
        return subtotal + assurance - get().cartDiscount;
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

      // Apply negotiated price to item
      applyNegotiatedPrice: (id, price) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id
              ? { ...item, negotiatedPrice: price, negotiationStatus: 'accepted' as const }
              : item
          ),
        }));
      },

      // Toggle assurance for item
      toggleAssurance: (id) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, hasAssurance: !item.hasAssurance } : item
          ),
        }));
      },

      // Apply cart-wide discount
      applyCartDiscount: (discountAmount) => {
        set({ cartDiscount: discountAmount });
      },

      // Clear all items
      clearCart: () => {
        set({ items: [], cartDiscount: 0 });
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
      storage: createJSONStorage(() => syncStorage),
      partialize: (state) => ({ items: state.items, cartDiscount: state.cartDiscount }),
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
