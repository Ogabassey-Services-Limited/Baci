/**
 * Optimistic Cart Hook - 2025 Best Practice
 *
 * Features:
 * - Immediate UI feedback (< 16ms reaction time)
 * - Automatic rollback on stock validation failure
 * - Toast notifications for stock errors
 * - Syncs with Zustand cart store
 */

import { useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCartStore, type CartItem } from '@/stores/cart-store';
import { supabase } from '@/lib/supabase';
import { Alert, Platform, ToastAndroid } from 'react-native';

// Types for cart operations
type AddToCartInput = Omit<CartItem, 'id'>;

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
 */
async function checkStock(
  productId: string,
  requestedQuantity: number
): Promise<StockCheckResult> {
  const { data, error } = await supabase
    .from('products')
    .select('stock_quantity')
    .eq('id', productId)
    .single();

  if (error) {
    console.error('Stock check failed:', error);
    // If we can't check stock, assume it's available (optimistic)
    return { available: true, currentStock: 999, requestedQuantity };
  }

  const currentStock = data?.stock_quantity ?? 999;
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
  const items = useCartStore((state) => state.items);
  const addItemToStore = useCartStore((state) => state.addItem);
  const removeItemFromStore = useCartStore((state) => state.removeItem);
  const updateQuantityInStore = useCartStore((state) => state.updateQuantity);
  const itemCount = useCartStore((state) => state.itemCount);
  const subtotal = useCartStore((state) => state.subtotal);
  const getItem = useCartStore((state) => state.getItem);

  // Track pending operations for rollback
  const pendingRollbacks = useRef<Map<string, () => void>>(new Map());

  /**
   * Add to cart with optimistic update and stock validation
   */
  const addToCartMutation = useMutation({
    mutationFn: async (item: AddToCartInput) => {
      // Check if item already exists to calculate total requested quantity
      const existingItem = getItem(item.product_id, item.variant_id);
      const totalQuantity = (existingItem?.quantity || 0) + item.quantity;

      // Validate stock in background
      const stockCheck = await checkStock(item.product_id, totalQuantity);

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

      // Capture current state for rollback
      const previousItems = [...items];

      // Optimistically add to cart (instant UI update)
      addItemToStore(item);

      // Store rollback function
      pendingRollbacks.current.set(rollbackId, () => {
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
    onSuccess: (_, __, context) => {
      if (context?.rollbackId) {
        pendingRollbacks.current.delete(context.rollbackId);
      }

      // Invalidate product queries to refresh stock data
      queryClient.invalidateQueries({ queryKey: ['products'] });
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
      const previousItems = [...items];
      const removedItem = items.find((i) => i.id === id);

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
      const item = items.find((i) => i.id === id);
      if (!item) throw new Error('Item not found');

      // Validate stock for the new quantity
      const stockCheck = await checkStock(item.product_id, quantity);

      if (!stockCheck.available) {
        throw new Error(
          `Only ${stockCheck.currentStock} items available in stock`
        );
      }

      return { id, quantity, stockCheck };
    },

    onMutate: async ({ id, quantity }) => {
      const previousItems = [...items];

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

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  // Wrapped functions for easier consumption
  const addToCart = useCallback(
    (item: AddToCartInput) => {
      addToCartMutation.mutate(item);
    },
    [addToCartMutation]
  );

  const removeFromCart = useCallback(
    (id: string) => {
      removeFromCartMutation.mutate(id);
    },
    [removeFromCartMutation]
  );

  const updateQuantity = useCallback(
    (id: string, quantity: number) => {
      updateQuantityMutation.mutate({ id, quantity });
    },
    [updateQuantityMutation]
  );

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
 */
export function useCartCount() {
  return useCartStore((state) => state.itemCount());
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
