import { toast } from '@/hooks/use-toast';
import type { ResumedOrder } from '../types';

export interface ExecuteDirectPaymentOptions {
  resumedOrder: ResumedOrder | null;
  preferredGateway: 'credpal' | 'credit_direct' | null;
  merchantSlug: string;
  setIsProcessing: (v: boolean) => void;
  clearCheckoutSession: () => void;
  routerPush: (url: string) => void;
  getHref: (path: string) => string;
}

/**
 * Execute direct payment for resumed orders (CredPal / Credit Direct).
 * Uses dynamic imports to lazy-load payment SDKs.
 */
export async function executeDirectPayment({
  resumedOrder,
  preferredGateway,
  merchantSlug,
  setIsProcessing,
  clearCheckoutSession,
  routerPush,
  getHref,
}: ExecuteDirectPaymentOptions): Promise<void> {
  if (!resumedOrder || !preferredGateway) return;

  setIsProcessing(true);
  try {
    const paymentAmount = resumedOrder.total;

    if (preferredGateway === 'credpal') {
      const { openCredPalCheckout, getCredPalKey } = await import(
        '@/lib/credpal'
      );
      const productNames =
        resumedOrder.items.map((item) => item.product_name).join(', ') ||
        'Purchase';

      await openCredPalCheckout({
        key: getCredPalKey(),
        amount: paymentAmount,
        product: productNames,
        customerEmail: resumedOrder.customer_email,
        customerName: resumedOrder.customer_name,
        customerPhone: resumedOrder.customer_phone,
        onSuccess: async (data) => {
          await fetch('/api/orders/update-payment-ref', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: resumedOrder.id,
              paymentRef: data.order_no,
              gateway: 'credpal',
            }),
          });
          clearCheckoutSession();
          const successQuery = new URLSearchParams({
            orderId: resumedOrder.id,
            type: 'credpal',
          });
          if (resumedOrder.tracking_token) {
            successQuery.set('trackingToken', resumedOrder.tracking_token);
          }
          routerPush(getHref(`/order-success?${successQuery.toString()}`));
        },
        onError: (error: { message?: string }) => {
          toast({
            title: 'Payment Failed',
            description: error.message || 'CredPal payment failed',
            variant: 'destructive',
          });
          setIsProcessing(false);
        },
        onClose: () => {
          setIsProcessing(false);
        },
      });
      return;
    }

    if (preferredGateway === 'credit_direct') {
      const { openCreditDirectCheckout } = await import(
        '@/lib/credit-direct-client'
      );

      await openCreditDirectCheckout({
        merchantSlug: merchantSlug || 'ogabassey',
        orderId: resumedOrder.id,
        amount: paymentAmount,
        customerEmail: resumedOrder.customer_email,
        customerPhone: resumedOrder.customer_phone,
        customerName: resumedOrder.customer_name,
        items: resumedOrder.items.map((item) => ({
          id: item.product_id,
          name: item.product_name,
          price: item.price,
          quantity: item.quantity,
        })),
        onSuccess: async (transactionId: string) => {
          await fetch('/api/orders/update-payment-ref', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: resumedOrder.id,
              paymentRef: transactionId,
              gateway: 'credit_direct',
            }),
          });
          clearCheckoutSession();
          const successQuery = new URLSearchParams({
            orderId: resumedOrder.id,
            type: 'credit_direct',
          });
          if (resumedOrder.tracking_token) {
            successQuery.set('trackingToken', resumedOrder.tracking_token);
          }
          routerPush(getHref(`/order-success?${successQuery.toString()}`));
        },
        onError: (error: string) => {
          toast({
            title: 'Payment Failed',
            description: error || 'Credit Direct payment failed',
            variant: 'destructive',
          });
          setIsProcessing(false);
        },
        onClose: () => {
          setIsProcessing(false);
        },
      });
      return;
    }
  } catch (error) {
    console.error('Payment execution error:', error);
    setIsProcessing(false);
  }
}
