import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { warmCheckoutEntry } from '@/components/checkout/checkout-entry-prefetch';

type CartCheckoutPrewarmOptions = {
  enabled: boolean;
  itemCount: number;
};

export function useCartCheckoutPrewarm({
  enabled,
  itemCount,
}: CartCheckoutPrewarmOptions) {
  const queryClient = useQueryClient();

  const prewarmCheckout = () => {
    router.prefetch('/checkout');
    warmCheckoutEntry(queryClient);
  };

  useEffect(() => {
    if (!enabled || itemCount <= 0) {
      return;
    }

    router.prefetch('/checkout');
    warmCheckoutEntry(queryClient);
  }, [enabled, itemCount, queryClient]);

  return prewarmCheckout;
}
