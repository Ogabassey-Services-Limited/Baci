/**
 * Shopping Cart Store using Zustand
 * Manages shopping cart state with AsyncStorage persistence
 * Compatible with Expo Go (no native modules required)
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { syncStorage } from '../lib/storage';
import {
  createCartLineId,
  isSameCartLine,
  mergeExistingCartItem,
} from './cart-line';
import type { CartItem } from './cart-store.types';

export type { CartItem } from './cart-store.types';

interface CartState {
  // State
  items: CartItem[];
  isLoading: boolean;
  lineSequence: number;
  // True while a cart-wide (group) negotiation is applied. Removing or
  // re-pricing an item invalidates the proportional group total, so the group
  // negotiation is reset when the cart composition changes.
  cartWideNegotiationActive: boolean;

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
  // Reconcile stored prices with the live catalog (keyed by cart line id).
  repriceItems: (priceById: Record<string, number>) => void;
  // Device assurance actions
  toggleAssurance: (id: string) => void;
}

export function resetCartLineSequence() {
  if (useCartStore.getState().items.length === 0) {
    useCartStore.setState({ lineSequence: 0 });
  }
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      // Initial state
      items: [],
      isLoading: false,
      lineSequence: 0,
      cartWideNegotiationActive: false,

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
          const itemToAdd =
            item.voucher_token || item.voucher_award_id
              ? { ...item, quantity: 1 }
              : item;

          // Check if item already exists (same product + variant + options)
          const existingIndex = state.items.findIndex((existingItem) =>
            isSameCartLine(existingItem, itemToAdd)
          );

          if (existingIndex >= 0) {
            // Refresh cart metadata from the latest add while preserving cart-only state.
            const updatedItems = [...state.items];
            const existingItem = updatedItems[existingIndex];
            updatedItems[existingIndex] = mergeExistingCartItem(
              existingItem,
              itemToAdd
            );

            return { items: updatedItems };
          }

          // Add new item
          const lineSequence = state.lineSequence + 1;
          const newItem: CartItem = {
            ...itemToAdd,
            id: createCartLineId(itemToAdd, lineSequence),
          };

          return { items: [...state.items, newItem], lineSequence };
        });
      },

      // Remove item from cart
      removeItem: (id) => {
        set((state) => {
          const items = state.items.filter((item) => item.id !== id);

          // A cart-wide (group) negotiation distributes one negotiated total
          // across all lines; removing a line breaks that total, so reset the
          // group negotiation and revert remaining lines to catalog price.
          if (state.cartWideNegotiationActive) {
            return {
              items: items.map((item) => ({
                ...item,
                negotiatedPrice: undefined,
                negotiationStatus: undefined,
              })),
              cartWideNegotiationActive: false,
            };
          }

          return { items };
        });
      },

      // Update item quantity
      updateQuantity: (id, quantity) => {
        set((state) => {
          if (quantity <= 0) {
            const items = state.items.filter((item) => item.id !== id);
            if (state.cartWideNegotiationActive) {
              return {
                items: items.map((item) => ({
                  ...item,
                  negotiatedPrice: undefined,
                  negotiationStatus: undefined,
                })),
                cartWideNegotiationActive: false,
              };
            }
            return { items };
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
        set({ items: [], lineSequence: 0, cartWideNegotiationActive: false });
      },

      // Get specific item
      getItem: (productId, variantId) => {
        return get().items.find(
          (item) =>
            item.product_id === productId && item.variant_id === variantId
        );
      },

      // Apply negotiated price to item (matches web feature parity).
      // This is an individual-line negotiation, so the group flag is cleared.
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
          cartWideNegotiationActive: false,
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
          cartWideNegotiationActive: true,
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
          cartWideNegotiationActive: false,
        }));
      },

      // Restore items directly (for rollback without generating new IDs)
      restoreItems: (items) => {
        set({ items });
      },

      // Reconcile line prices from live catalog values keyed by cart line id.
      // When a base price actually changes, any prior negotiation was made
      // against a stale basis and would be rejected at checkout, so it is
      // cleared — the shopper re-negotiates against the current price.
      repriceItems: (priceById) => {
        set((state) => {
          let changed = false;
          let items = state.items.map((item) => {
            const livePrice = priceById[item.id];
            if (typeof livePrice !== 'number' || !Number.isFinite(livePrice)) {
              return item;
            }
            if (livePrice === item.price) {
              return item;
            }
            changed = true;
            return {
              ...item,
              price: livePrice,
              negotiatedPrice: undefined,
              negotiationStatus: undefined,
            };
          });
          if (!changed) {
            return { items };
          }
          // A reprice that clears negotiations also breaks any group total.
          // A cart-wide negotiation distributes one agreed total across every
          // line, so clearing only the drifted lines would leave the rest with
          // a stale group share (an inconsistent partial total). When the group
          // was active, clear the negotiation on ALL lines — mirroring the
          // reset done in removeItem / updateQuantity.
          if (state.cartWideNegotiationActive) {
            items = items.map((item) =>
              item.negotiatedPrice === undefined &&
              item.negotiationStatus === undefined
                ? item
                : {
                    ...item,
                    negotiatedPrice: undefined,
                    negotiationStatus: undefined,
                  }
            );
          }
          return { items, cartWideNegotiationActive: false };
        });
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
      partialize: (state) => ({
        items: state.items,
        lineSequence: state.lineSequence,
        cartWideNegotiationActive: state.cartWideNegotiationActive,
      }),
    }
  )
);

const NGN_PRICE_FORMATTER = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * Format price in Naira
 */
export function formatPrice(amount: number): string {
  return NGN_PRICE_FORMATTER.format(amount);
}

let cachedCartItems: CartItem[] | null = null;
let cachedCartQuantities = new Map<string, number>();

/**
 * Memoized map of `product_id` → total quantity, rebuilt only when `items`
 * changes. Returns a read-only map (do not mutate the shared cache). Lets each
 * product card read its count in O(1) (a number primitive) instead of an
 * O(items) filter+reduce scan per card.
 */
export function selectCartQuantities(state: {
  items: CartItem[];
}): ReadonlyMap<string, number> {
  if (state.items !== cachedCartItems) {
    cachedCartItems = state.items;
    const next = new Map<string, number>();
    for (const item of state.items) {
      const key = String(item.product_id);
      next.set(key, (next.get(key) ?? 0) + item.quantity);
    }
    cachedCartQuantities = next;
  }
  return cachedCartQuantities;
}
