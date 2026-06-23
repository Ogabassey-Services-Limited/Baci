import { useEffect, useRef, useState } from 'react';
import { CONSTANT_MERCHANT_ID } from '@/hooks/product-utils';
import { useMerchant } from '@/hooks/use-merchant';
import {
  type CartPriceChange,
  repriceCartItems,
} from '@/services/cart-reprice';
import { useCartStore } from '@/stores/cart-store';

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
  const repriceItems = useCartStore((state) => state.repriceItems);
  const [priceChanges, setPriceChanges] = useState<CartPriceChange[]>([]);
  const hasRunRef = useRef(false);

  const merchantId = merchant?.id || CONSTANT_MERCHANT_ID;

  useEffect(() => {
    if (hasRunRef.current || !merchantId) {
      return;
    }
    const items = useCartStore.getState().items;
    if (items.length === 0) {
      return;
    }
    hasRunRef.current = true;

    let cancelled = false;
    repriceCartItems(items, merchantId)
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (Object.keys(result.priceById).length > 0) {
          repriceItems(result.priceById);
        }
        if (result.changes.length > 0) {
          setPriceChanges(result.changes);
        }
      })
      .catch(() => {
        // Fail open: never block the cart on a pricing refresh failure.
      });

    return () => {
      cancelled = true;
    };
  }, [merchantId, repriceItems]);

  return {
    priceChanges,
    dismissPriceChanges: () => setPriceChanges([]),
  };
}
