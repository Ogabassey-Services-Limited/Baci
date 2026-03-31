/**
 * Shopping Cart Store using Zustand
 * Manages shopping cart state with AsyncStorage persistence
 * Compatible with Expo Go (no native modules required)
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { syncStorage } from '../lib/storage';

export interface CartItem {
  id: string;
  product_id: string;
  slug: string;
  variant_id?: string;
  variant_attributes?: Record<string, string>;
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
  // Negotiation support (matches web feature parity)
  negotiatedPrice?: number;
  negotiationStatus?: 'pending' | 'accepted' | 'rejected';
  // Device assurance support
  hasAssurance?: boolean;
  assuranceRate?: number;
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
  // Negotiation actions (matches web feature parity)
  applyNegotiatedPrice: (id: string, negotiatedPrice: number) => void;
  applyCartWideNegotiation: (newTotal: number) => void;
  clearNegotiatedPrice: (id: string) => void;
  // Restore actions (for rollback without generating new IDs)
  restoreItems: (items: CartItem[]) => void;
  // Device assurance actions
  toggleAssurance: (id: string) => void;
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
        return get().items.reduce((total, item) => {
          // Use negotiated price if available (matches web behavior)
          const effectivePrice = item.negotiatedPrice ?? item.price;
          const itemTotal = effectivePrice * item.quantity;
          // Assurance is calculated separately in UI/checkout layer
          // DO NOT include assurance here to avoid double-counting
          return total + itemTotal;
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

      // Add item to cart
      addItem: (item) => {
        set((state) => {
          // Check if item already exists (same product + variant + options)
          const existingIndex = state.items.findIndex(
            (i) =>
              i.product_id === item.product_id &&
              i.variant_id === item.variant_id &&
              (i.color ?? null) === (item.color ?? null) &&
              (i.storage ?? null) === (item.storage ?? null) &&
              (i.condition ?? null) === (item.condition ?? null)
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
            id: `${item.product_id}::${item.variant_id || 'default'}::${Date.now()}`,
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
          (item) =>
            item.product_id === productId && item.variant_id === variantId
        );
      },

      // Apply negotiated price to item (matches web feature parity)
      applyNegotiatedPrice: (id, negotiatedPrice) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id
              ? {
                  ...item,
                  negotiatedPrice,
                  negotiationStatus: 'accepted' as const,
                }
              : item
          ),
        }));
      },

      // Apply negotiation to the whole cart (matches web behavior)
      applyCartWideNegotiation: (newTotal) => {
        const { items } = get();
        const currentTotal = items.reduce((sum, item) => {
          const price = item.negotiatedPrice ?? item.price;
          return sum + price * item.quantity;
        }, 0);

        if (currentTotal <= 0) return;
        const ratio = newTotal / currentTotal;

        set((state) => ({
          items: state.items.map((item) => {
            const currentPrice = item.negotiatedPrice ?? item.price;
            return {
              ...item,
              negotiatedPrice: Math.round(currentPrice * ratio),
              negotiationStatus: 'accepted' as const,
            };
          }),
        }));
      },

      // Clear negotiated price from item
      clearNegotiatedPrice: (id) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id
              ? {
                  ...item,
                  negotiatedPrice: undefined,
                  negotiationStatus: undefined,
                }
              : item
          ),
        }));
      },

      // Restore items directly (for rollback without generating new IDs)
      restoreItems: (items) => {
        set({ items });
      },

      // Toggle device assurance for item
      // Only stores a boolean flag; the actual fee is computed at checkout
      // using the item's current effective price (negotiatedPrice ?? price).
      toggleAssurance: (id) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id
              ? {
                  ...item,
                  hasAssurance: !item.hasAssurance,
                }
              : item
          ),
        }));
      },
    }),
    {
      name: 'cart-storage',
      storage: createJSONStorage(() => syncStorage),
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
