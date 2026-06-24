import { useIsFocused } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { CONSTANT_MERCHANT_ID } from '@/hooks/product-utils';
import { useMerchant } from '@/hooks/use-merchant';
import {
  type CartPriceChange,
  repriceCartItems,
} from '@/services/cart-reprice';
import { useCartStore } from '@/stores/cart-store';
import type { CartItem } from '@/stores/cart-store.types';

function getCartRepriceKey(items: CartItem[]) {
  return items
    .map(
      (item) =>
        `${item.id}:${item.product_id}:${item.variant_id ?? ''}:${item.quantity}`
    )
    .join('|');
}

/**
 * Reconciles cart line prices against the live catalog when the cart opens.
 *
 * Best-practice pattern (commercetools "Recalculate" / Medusa refresh): the
 * persisted cart is a display cache; the live catalog is the source of truth.
 * On open we re-fetch authoritative prices, update the cart, and surface any
 * change to the shopper instead of letting it fail cryptically at checkout.
 */
export function useCartReprice() {
  const { data: merchant } = useMerchant();
  const isFocused = useIsFocused();
  const items = useCartStore((state) => state.items);
  const repriceItems = useCartStore((state) => state.repriceItems);
  const [priceChanges, setPriceChanges] = useState<CartPriceChange[]>([]);
  const lastRepriceKeyRef = useRef<string | null>(null);

  const merchantId = merchant?.id ?? CONSTANT_MERCHANT_ID;
  const cartRepriceKey = getCartRepriceKey(items);

  useEffect(() => {
    if (!isFocused || items.length === 0) {
      lastRepriceKeyRef.current = null;
      return;
    }

    const repriceKey = `${merchantId}:${cartRepriceKey}`;
    if (lastRepriceKeyRef.current === repriceKey) {
      return;
    }
    lastRepriceKeyRef.current = repriceKey;

    let cancelled = false;
    void repriceCartItems(items, merchantId)
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (result.changes.length > 0) {
          // Apply only the reported changes. repriceCartItems keeps ≤₦1
          // tolerance drift out of `changes` (though still in priceById);
          // applying those would silently clear an accepted negotiated price
          // with no price-change modal shown.
          const changedPriceById: Record<string, number> = {};
          for (const change of result.changes) {
            const livePrice = result.priceById[change.id];
            if (typeof livePrice === 'number') {
              changedPriceById[change.id] = livePrice;
            }
          }
          repriceItems(changedPriceById);
          setPriceChanges(result.changes);
        }
      })
      .catch(() => {
        // Fail open: never block the cart on a pricing refresh failure.
      });

    return () => {
      cancelled = true;
    };
  }, [cartRepriceKey, isFocused, items, merchantId, repriceItems]);

  return {
    priceChanges,
    dismissPriceChanges: () => setPriceChanges([]),
  };
}
