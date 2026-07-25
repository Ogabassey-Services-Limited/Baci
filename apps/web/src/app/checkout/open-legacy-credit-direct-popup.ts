import type { CheckoutOrderItem } from '@/lib/checkout/build-order-items';
import {
  buildLegacyCreditDirectTransaction,
  type LegacyCreditDirectTransaction,
} from './legacy-credit-direct-transaction';

interface CreditDirectSdkResponse {
  checkoutTransactionId?: string;
}

interface CreditDirectPopupToast {
  title: string;
  description?: string;
  variant?: 'destructive';
}

export interface OpenLegacyCreditDirectPopupParams {
  /** Server-signed amount + keys returned by /api/payments/credit-direct/sign. */
  sign: {
    signature: string;
    publicKey: string;
    sessionId: string;
    isLive: boolean;
    amount: number;
  };
  orderId: string;
  /** Canonical order items — the allocation is weighted by their prices. */
  orderItems: Pick<
    CheckoutOrderItem,
    'product_id' | 'name' | 'price' | 'quantity'
  >[];
  customerEmail: string;
  customerPhone: string;
  /** `window.Connect`; undefined when the SDK script has not loaded. */
  connect: typeof window.Connect;
  toast: (options: CreditDirectPopupToast) => void;
  setLoading: (loading: boolean) => void;
  /** Page-owned success handler (client-completion handoff + navigation). */
  onSuccess: (response?: CreditDirectSdkResponse) => void;
  /** Page-owned popup handler (payment-reference capture). */
  onPopup: (response?: CreditDirectSdkResponse) => void;
}

/**
 * Open the Credit Direct BNPL popup for the legacy checkout.
 *
 * Extracted from the oversized checkout page so the SDK orchestration —
 * SDK-loaded guard, building the transaction from the SERVER-signed amount over
 * the canonical order items, fail-closed error handling, and wiring the
 * cancel/success/popup callbacks — lives in one focused, testable unit. The
 * page injects its own success/popup handlers (which need order/merchant/router
 * context) plus the toast + loading effects.
 */
export function openLegacyCreditDirectPopup(
  params: OpenLegacyCreditDirectPopupParams
): void {
  const {
    sign,
    orderId,
    orderItems,
    customerEmail,
    customerPhone,
    connect,
    toast,
    setLoading,
    onSuccess,
    onPopup,
  } = params;

  if (!connect) {
    toast({
      variant: 'destructive',
      title: 'BNPL Checkout Failed',
      description: 'Credit Direct SDK not loaded',
    });
    setLoading(false);
    return;
  }

  // Uses the SERVER-signed amount (never order.total) and allocates it across
  // the canonical order items. Fails closed (toast + clear loading) rather than
  // opening a popup whose total diverges from the HMAC signature.
  let transaction: LegacyCreditDirectTransaction;
  try {
    transaction = buildLegacyCreditDirectTransaction({
      signedAmount: sign.amount,
      customerEmail,
      customerPhone,
      sessionId: sign.sessionId,
      orderId,
      orderItems,
    });
  } catch (error) {
    toast({
      variant: 'destructive',
      title: 'BNPL Checkout Failed',
      description:
        error instanceof Error
          ? error.message
          : 'Failed to start Credit Direct checkout',
    });
    setLoading(false);
    return;
  }

  const instance = new connect({
    publicKey: sign.publicKey,
    signature: sign.signature,
    transaction,
    isLive: sign.isLive,
    onSuccess,
    onClose: () => {
      toast({
        title: 'Checkout Cancelled',
        description: 'You can complete your purchase anytime.',
      });
      setLoading(false);
    },
    onPopup,
  });

  instance.setup();
  instance.open();
}
