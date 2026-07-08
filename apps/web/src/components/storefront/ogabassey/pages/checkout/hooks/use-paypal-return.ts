'use client';

import { useEffect, useRef } from 'react';
import { toast } from '@/hooks/use-toast';
import { capturePaypalReturn } from '@/lib/paypal-checkout-client';

interface UsePaypalReturnParams {
  merchantId: string | undefined;
  getHref: (path: string) => string;
  routerPush: (url: string) => void;
  clearCart: () => void;
  clearCheckoutSession: () => void;
  setIsProcessing?: (value: boolean) => void;
}

/**
 * Completes the storefront PayPal redirect flow (Wave 2, BYOK Phase 2 item 8).
 *
 * When the browser returns from PayPal's approval page (`?paypal_return=1` with
 * the paypal order id in `?token=`, or `?paypal_cancel=1`), this captures the
 * payment via the server route and routes to the order-success page. A ref
 * guards against double-capture across re-renders; the server capture is
 * idempotent regardless.
 */
export function usePaypalReturn({
  merchantId,
  getHref,
  routerPush,
  clearCart,
  clearCheckoutSession,
  setIsProcessing,
}: UsePaypalReturnParams): void {
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current || typeof window === 'undefined') return;

    const search = window.location.search;
    if (!search.includes('paypal_return') && !search.includes('paypal_cancel')) {
      return;
    }
    handledRef.current = true;

    let active = true;

    (async () => {
      setIsProcessing?.(true);
      const result = await capturePaypalReturn(search, merchantId);
      if (!active) return;

      if (result.status === 'captured') {
        clearCheckoutSession();
        clearCart();
        const trackingParam = result.trackingToken
          ? `&trackingToken=${result.trackingToken}`
          : '';
        routerPush(
          getHref(
            `/order-success?type=paypal&orderId=${result.orderId}${trackingParam}`
          )
        );
        return;
      }

      if (result.status === 'cancelled') {
        toast({
          title: 'PayPal payment cancelled',
          description: 'You can try again or choose another payment method.',
        });
      } else if (result.status === 'error') {
        toast({
          title: 'PayPal payment failed',
          description: result.message || 'Please try again.',
          variant: 'destructive',
        });
      }
      setIsProcessing?.(false);
    })();

    return () => {
      active = false;
    };
  }, [
    merchantId,
    getHref,
    routerPush,
    clearCart,
    clearCheckoutSession,
    setIsProcessing,
  ]);
}
