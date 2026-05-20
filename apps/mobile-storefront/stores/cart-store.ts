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
  voucher_token?: string;
  voucher_award_id?: string;
}

function createCartLineId(
  item: Omit<CartItem, 'id'>,
  sequence: number
): string {
  // Award IDs are stable after redemption; pending awards use voucher_token,
  // and plain products use the persisted monotonic sequence for new lines.
  const voucherIdentifier = item.voucher_award_id ?? item.voucher_token;
  const uniquePart = voucherIdentifier
    ? `${voucherIdentifier}::${sequence}`
    : `cart-line::${sequence}`;

  return `${item.product_id}::${item.variant_id || 'default'}::${uniquePart}`;
}

function getNormalizedVoucherIdentifier(value: string | undefined) {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : null;
}

function hasVoucherIdentifier(
  item: Pick<CartItem, 'voucher_award_id' | 'voucher_token'>
) {
  return Boolean(
    getNormalizedVoucherIdentifier(item.voucher_award_id) ||
      getNormalizedVoucherIdentifier(item.voucher_token)
  );
}

function hasMatchingVoucherIdentifier(
  existingItem: Pick<CartItem, 'voucher_award_id' | 'voucher_token'>,
  incomingItem: Pick<CartItem, 'voucher_award_id' | 'voucher_token'>
) {
  const existingAwardId = getNormalizedVoucherIdentifier(
    existingItem.voucher_award_id
  );
  const incomingAwardId = getNormalizedVoucherIdentifier(
    incomingItem.voucher_award_id
  );
  const existingToken = getNormalizedVoucherIdentifier(
    existingItem.voucher_token
  );
  const incomingToken = getNormalizedVoucherIdentifier(
    incomingItem.voucher_token
  );

  return (
    (existingAwardId !== null && existingAwardId === incomingAwardId) ||
    (existingToken !== null && existingToken === incomingToken)
  );
}

function mergeExistingCartItem(
  existingItem: CartItem,
  incomingItem: Omit<CartItem, 'id'>
): CartItem {
  const newQuantity = existingItem.quantity + incomingItem.quantity;
  const isVoucherLine =
    hasVoucherIdentifier(existingItem) || hasVoucherIdentifier(incomingItem);

  return {
    ...existingItem,
    ...incomingItem,
    id: existingItem.id,
    quantity: isVoucherLine
      ? 1
      : existingItem.max_quantity
        ? Math.min(newQuantity, existingItem.max_quantity)
        : newQuantity,
    negotiatedPrice: existingItem.negotiatedPrice,
    negotiationStatus: existingItem.negotiationStatus,
    hasAssurance: existingItem.hasAssurance,
    assuranceRate: existingItem.assuranceRate,
  };
}

interface CartState {
  // State
  items: CartItem[];
  isLoading: boolean;
  lineSequence: number;

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

export function resetCartLineSequence() {
  if (useCartStore.getState().items.length === 0) {
    useCartStore.setState({ lineSequence: 0 });
  }
}

function areEquivalentCartAttributes(
  existingValue: string | undefined,
  incomingValue: string | undefined
) {
  const normalizedExistingValue = existingValue ?? null;
  const normalizedIncomingValue = incomingValue ?? null;

  return (
    normalizedExistingValue === normalizedIncomingValue ||
    normalizedExistingValue === null ||
    normalizedIncomingValue === null
  );
}

function isSameCartLine(
  existingItem: CartItem,
  incomingItem: Omit<CartItem, 'id'>
) {
  const existingHasVoucher = hasVoucherIdentifier(existingItem);
  const incomingHasVoucher = hasVoucherIdentifier(incomingItem);

  if (existingHasVoucher || incomingHasVoucher) {
    if (!existingHasVoucher || !incomingHasVoucher) {
      return false;
    }

    if (!hasMatchingVoucherIdentifier(existingItem, incomingItem)) {
      return false;
    }
  }

  if (existingItem.product_id !== incomingItem.product_id) {
    return false;
  }

  const existingVariantId = existingItem.variant_id ?? null;
  const incomingVariantId = incomingItem.variant_id ?? null;

  if (existingVariantId !== incomingVariantId) {
    return false;
  }

  if (existingVariantId || incomingVariantId) {
    return (
      areEquivalentCartAttributes(existingItem.color, incomingItem.color) &&
      areEquivalentCartAttributes(existingItem.storage, incomingItem.storage) &&
      areEquivalentCartAttributes(
        existingItem.condition,
        incomingItem.condition
      )
    );
  }

  return (
    (existingItem.color ?? null) === (incomingItem.color ?? null) &&
    (existingItem.storage ?? null) === (incomingItem.storage ?? null) &&
    (existingItem.condition ?? null) === (incomingItem.condition ?? null)
  );
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      // Initial state
      items: [],
      isLoading: false,
      lineSequence: 0,

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
        set({ items: [], lineSequence: 0 });
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
      partialize: (state) => ({
        items: state.items,
        lineSequence: state.lineSequence,
      }),
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
