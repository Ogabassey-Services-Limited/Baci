/**
 * Optimistic Cart Hook - 2026 Best Practice
 *
 * Features:
 * - Immediate UI feedback (< 16ms reaction time)
 * - Automatic rollback on stock validation failure
 * - Toast notifications for stock errors
 * - Syncs with Zustand cart store
 * - Network awareness before mutations (2026 Best Practice)
 */

import NetInfo from '@react-native-community/netinfo';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { Alert, Platform, ToastAndroid } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { createLogger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { type CartItem, useCartStore } from '@/stores/cart-store';

const log = createLogger('Cart');

/**
 * Check network connectivity before mutations
 * 2026 Best Practice: Always verify network before data operations
 */
async function checkNetwork(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected === true && state.isInternetReachable !== false;
}

// Types for cart operations
type AddToCartInput = Omit<CartItem, 'id'>;

function getExistingCartQuantityForStock(item: AddToCartInput): number {
  const variantId = item.variant_id ?? null;
  return useCartStore
    .getState()
    .items.reduce(
      (total, cartItem) =>
        cartItem.product_id === item.product_id &&
        (cartItem.variant_id ?? null) === variantId
          ? total + cartItem.quantity
          : total,
      0
    );
}

function getIncomingCartQuantityForStock(item: AddToCartInput): number {
  return item.voucher_token || item.voucher_award_id ? 1 : item.quantity;
}

interface StockCheckResult {
  available: boolean;
  currentStock: number;
  requestedQuantity: number;
}

// Toast helper for cross-platform notifications
const showToast = (message: string, type: 'error' | 'success' = 'error') => {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else {
    // iOS doesn't have native toast, use a light alert
    Alert.alert(
      type === 'error' ? 'Stock Error' : 'Success',
      message,
      [{ text: 'OK' }],
      {
        cancelable: true,
      }
    );
  }
};

/**
 * Check stock availability from the database
 * 2026 Best Practice: Verify network before database operations
 *
 * @param cachedStock - Last known stock from TanStack Query cache, used as
 *   fallback when offline or on query error. If no cached value exists,
 *   stock check will fail to prevent overselling.
 */
async function checkStock(
  productId: string,
  requestedQuantity: number,
  cachedStock?: number
): Promise<StockCheckResult> {
  // 2026 Best Practice: Check network before database call
  const isOnline = await checkNetwork();
  if (!isOnline) {
    if (cachedStock === undefined) {
      // No cached stock available - block add-to-cart to prevent overselling
      log.error(
        'Offline: No cached stock data available, blocking add-to-cart'
      );
      throw new Error(
        'Cannot verify stock while offline. Please try again when connected.'
      );
    }
    log.warn(
      `Offline: Stock check skipped, using cached estimate (${cachedStock})`
    );
    return {
      available: requestedQuantity <= cachedStock,
      currentStock: cachedStock,
      requestedQuantity,
    };
  }

  const { data, error } = await supabase
    .from('products')
    .select('stock_quantity, manage_stock')
    .eq('id', productId)
    .single();

  if (error) {
    log.error('Stock check failed:', error);
    if (cachedStock === undefined) {
      // No cached stock available - block add-to-cart to prevent overselling
      throw new Error('Cannot verify stock availability. Please try again.');
    }
    // Fall back to cached stock on database error
    return {
      available: requestedQuantity <= cachedStock,
      currentStock: cachedStock,
      requestedQuantity,
    };
  }

  // If stock management is disabled, treat as unlimited
  if (!data?.manage_stock) {
    return {
      available: true,
      currentStock: Number.MAX_SAFE_INTEGER,
      requestedQuantity,
    };
  }

  const currentStock = data?.stock_quantity ?? 0;
  return {
    available: currentStock >= requestedQuantity,
    currentStock,
    requestedQuantity,
  };
}

/**
 * Main hook for optimistic cart operations
 */
export function useCart() {
  const queryClient = useQueryClient();

  // Get store actions
  const {
    items,
    addItem: addItemToStore,
    removeItem: removeItemFromStore,
    updateQuantity: updateQuantityInStore,
    itemCount,
    subtotal,
    getItem,
  } = useCartStore(
    useShallow((state) => ({
      items: state.items,
      addItem: state.addItem,
      removeItem: state.removeItem,
      updateQuantity: state.updateQuantity,
      itemCount: state.itemCount,
      subtotal: state.subtotal,
      getItem: state.getItem,
    }))
  );

  // Track pending operations for rollback
  const pendingRollbacks = useRef<Map<string, () => void>>(new Map());

  /** L11 fix: Evict oldest rollback entries to prevent memory leak under rapid mutation spam */
  function trackRollback(id: string, fn: () => void) {
    const map = pendingRollbacks.current;
    // Keep at most 50 pending rollbacks
    if (map.size >= 50) {
      const oldestKey = map.keys().next().value;
      if (oldestKey !== undefined) {
        map.delete(oldestKey);
      }
    }
    map.set(id, fn);
  }

  /** Look up last-known stock_quantity from TanStack Query product cache */
  function getCachedStock(productId: string): number | undefined {
    const queries = queryClient.getQueriesData<{ stock_quantity?: number }[]>({
      queryKey: ['products'],
    });
    for (const [, data] of queries) {
      if (!Array.isArray(data)) continue;
      for (const p of data) {
        if (
          p &&
          typeof p === 'object' &&
          'id' in p &&
          (p as { id: string }).id === productId &&
          p.stock_quantity != null
        ) {
          return p.stock_quantity;
        }
      }
    }
    return undefined;
  }

  /**
   * Add to cart with optimistic update and stock validation
   */
  const addToCartMutation = useMutation({
    mutationFn: async (item: AddToCartInput) => {
      const totalQuantity =
        getExistingCartQuantityForStock(item) +
        getIncomingCartQuantityForStock(item);

      // Validate stock in background, with cached fallback for offline
      const stockCheck = await checkStock(
        item.product_id,
        totalQuantity,
        getCachedStock(item.product_id)
      );

      if (!stockCheck.available) {
        throw new Error(
          `Only ${stockCheck.currentStock} items available in stock`
        );
      }

      return { item, stockCheck };
    },

    // Optimistic update - runs immediately before mutationFn
    onMutate: async (item) => {
      // Generate a temporary ID for potential rollback
      const rollbackId = `${item.product_id}-${item.variant_id || 'default'}-${Date.now()}`;

      // Capture current state for rollback (read fresh from store to avoid stale closure)
      const previousItems = [...useCartStore.getState().items];

      // Optimistically add to cart (instant UI update)
      addItemToStore(item);

      // Store rollback function (L11 fix: uses trackRollback to enforce size limit)
      trackRollback(rollbackId, () => {
        // Restore previous state
        useCartStore.setState({ items: previousItems });
      });

      return { rollbackId, previousItems };
    },

    // On error, rollback the optimistic update
    onError: (error, _item, context) => {
      if (context?.rollbackId) {
        const rollback = pendingRollbacks.current.get(context.rollbackId);
        if (rollback) {
          rollback();
          pendingRollbacks.current.delete(context.rollbackId);
        }
      }

      // Show stock error toast
      showToast(
        error instanceof Error ? error.message : 'Failed to add to cart',
        'error'
      );
    },

    // Cleanup on success
    onSuccess: (data, _item, context) => {
      if (context?.rollbackId) {
        pendingRollbacks.current.delete(context.rollbackId);
      }

      // Invalidate specific product query to refresh stock data
      queryClient.invalidateQueries({
        queryKey: ['product', data.item.product_id],
      });
    },
  });

  /**
   * Remove from cart with optimistic update
   */
  const removeFromCartMutation = useMutation({
    mutationFn: async (id: string) => {
      // No backend validation needed for removal
      return { id };
    },

    onMutate: async (id) => {
      // Read fresh from store to avoid stale closure
      const freshItems = useCartStore.getState().items;
      const previousItems = [...freshItems];
      const removedItem = freshItems.find((i) => i.id === id);

      // Optimistically remove from cart
      removeItemFromStore(id);

      return { previousItems, removedItem };
    },

    onError: (_error, _id, context) => {
      if (context?.previousItems) {
        useCartStore.setState({ items: context.previousItems });
      }
      showToast('Failed to remove item', 'error');
    },
  });

  /**
   * Update quantity with optimistic update and stock validation
   */
  const updateQuantityMutation = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      // H21 fix: Read fresh items from store instead of stale closure variable
      const freshItems = useCartStore.getState().items;
      const item = freshItems.find((i) => i.id === id);
      if (!item) throw new Error('Item not found');

      // Validate stock for the new quantity, with cached fallback for offline
      const stockCheck = await checkStock(
        item.product_id,
        quantity,
        getCachedStock(item.product_id)
      );

      if (!stockCheck.available) {
        throw new Error(
          `Only ${stockCheck.currentStock} items available in stock`
        );
      }

      return { id, quantity, stockCheck };
    },

    onMutate: async ({ id, quantity }) => {
      // Read fresh from store to avoid stale closure
      const previousItems = [...useCartStore.getState().items];

      // Optimistically update quantity
      updateQuantityInStore(id, quantity);

      return { previousItems };
    },

    onError: (_error, _, context) => {
      if (context?.previousItems) {
        useCartStore.setState({ items: context.previousItems });
      }
      showToast('Stock Error: Quantity adjusted to available stock', 'error');
    },

    onSuccess: (data) => {
      // Bug #96 fix: Read fresh items from store instead of stale closure
      const freshItems = useCartStore.getState().items;
      const item = freshItems.find((i) => i.id === data.id);
      if (item) {
        queryClient.invalidateQueries({
          queryKey: ['product', item.product_id],
        });
      }
    },
  });

  // Wrapped functions for easier consumption
  const addToCart = (item: AddToCartInput) => {
    addToCartMutation.mutate(item);
  };

  const removeFromCart = (id: string) => {
    removeFromCartMutation.mutate(id);
  };

  const updateQuantity = (id: string, quantity: number) => {
    updateQuantityMutation.mutate({ id, quantity });
  };

  return {
    // State
    items,
    itemCount: itemCount(),
    subtotal: subtotal(),

    // Optimistic actions
    addToCart,
    removeFromCart,
    updateQuantity,

    // Mutation states for UI feedback
    isAddingToCart: addToCartMutation.isPending,
    isRemovingFromCart: removeFromCartMutation.isPending,
    isUpdatingQuantity: updateQuantityMutation.isPending,

    // Direct store access for non-optimistic operations
    getItem,
    clearCart: useCartStore.getState().clearCart,
  };
}

/**
 * Hook for just getting cart count (optimized for tab bar badge)
 * M18 fix: Compute count directly in selector to avoid calling a function
 * inside the selector (which creates a new value every time and causes re-renders).
 */
export function useCartCount() {
  return useCartStore((state) => state.items.length);
}

/**
 * Hook for checking if a product is in cart
 */
export function useIsInCart(productId: string, variantId?: string) {
  const items = useCartStore((state) => state.items);
  return items.some(
    (item) => item.product_id === productId && item.variant_id === variantId
  );
}
