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

  // Hold the caller callbacks in a ref refreshed each render. The parent passes
  // inline `getHref`/`routerPush`/… whose identity changes every render; if the
  // capture effect depended on them its cleanup would run on every re-render,
  // flip `active=false`, and DISCARD an in-flight successful capture — stranding
  // the customer on checkout (use-paypal-return:49). Narrowing the effect deps
  // to `[merchantId]` (the flow is already single-shot via `handledRef`) keeps
  // the effect stable while the ref serves the latest callbacks.
  const callbacksRef = useRef({
    getHref,
    routerPush,
    clearCart,
    clearCheckoutSession,
    setIsProcessing,
  });
  callbacksRef.current = {
    getHref,
    routerPush,
    clearCart,
    clearCheckoutSession,
    setIsProcessing,
  };

  useEffect(() => {
    if (handledRef.current || typeof window === 'undefined') return;

    const search = window.location.search;
    if (!search.includes('paypal_return') && !search.includes('paypal_cancel')) {
      return;
    }
    handledRef.current = true;

    (async () => {
      const cb = callbacksRef.current;
      cb.setIsProcessing?.(true);
      const result = await capturePaypalReturn(search, merchantId);
      const current = callbacksRef.current;

      if (result.status === 'captured') {
        current.clearCheckoutSession();
        current.clearCart();
        const trackingParam = result.trackingToken
          ? `&trackingToken=${result.trackingToken}`
          : '';
        current.routerPush(
          current.getHref(
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
      current.setIsProcessing?.(false);
    })();
    // Single-shot: guarded by `handledRef`, keyed only to `merchantId`. Do NOT
    // add the caller callbacks here — their changing identity would tear down
    // an in-flight capture.
  }, [merchantId]);
}
