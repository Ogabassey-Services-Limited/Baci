/**
 * Credit Direct BNPL - Client-side checkout helpers
 *
 * This module handles the browser-side popup checkout flow.
 * Server-side signing is done via /api/payments/credit-direct/sign
 */
import { prepareCreditDirectAmounts } from './credit-direct-products';

// Credit Direct SDK script URL
const CREDIT_DIRECT_SCRIPT_URL =
  'https://checkout.creditdirect.ng/bnpl/checkout.min.js';

export interface CreditDirectProduct {
  productName: string;
  productAmount: number;
  productId: string;
}

export interface CreditDirectTransaction {
  totalAmount: number;
  customerEmail: string;
  customerPhone: string;
  sessionId: string;
  metaData: string;
  products: CreditDirectProduct[];
}

export interface CreditDirectCheckoutReference {
  checkoutTransactionId: string | null;
  sessionId: string;
}

export interface CreditDirectCheckoutOptions {
  merchantSlug: string;
  orderId: string;
  amount: number;
  // The order's unguessable tracking token — forwarded to the sign endpoint so
  // the DB can gate capability-token minting on it (S2-P).
  trackingToken: string;
  customerEmail: string;
  customerPhone: string;
  customerName: string;
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  onSuccess: (reference: CreditDirectCheckoutReference) => void;
  onClose: () => void;
  onError: (error: string) => void;
  onPopup?: (reference: CreditDirectCheckoutReference) => void;
}

interface SignResponse {
  signature: string;
  publicKey: string;
  sessionId: string;
  isLive: boolean;
  // Server-derived amount that was actually signed. The popup MUST use this so
  // transaction.totalAmount matches the HMAC signature (signTransaction folds
  // the amount into the signature); a client-supplied amount can diverge from
  // the DB residual for wallet/partial-payment orders. REQUIRED — we fail
  // closed rather than fall back to the caller-supplied amount, which would
  // reintroduce a client-controlled popup total on a stale/partial response.
  amount: number;
  error?: string;
}

interface CreditDirectSdkPayload {
  checkoutTransactionId?: string;
}

// Global type for Credit Direct SDK
declare global {
  interface Window {
    Connect?: new (config: {
      publicKey: string;
      signature: string;
      transaction: CreditDirectTransaction;
      isLive: boolean;
      onSuccess: (response?: CreditDirectSdkPayload) => void;
      onClose: () => void;
      onPopup: (response?: CreditDirectSdkPayload) => void;
    }) => {
      setup: () => void;
      open: () => void;
    };
  }
}

/**
 * Check if Credit Direct SDK is loaded
 */
export function isCreditDirectLoaded(): boolean {
  return typeof window !== 'undefined' && 'Connect' in window;
}

/**
 * Load the Credit Direct checkout script
 */
export function loadCreditDirectScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isCreditDirectLoaded()) {
      resolve();
      return;
    }

    const existingScript = document.querySelector(
      `script[src="${CREDIT_DIRECT_SCRIPT_URL}"]`
    );
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', () =>
        reject(new Error('Failed to load Credit Direct script'))
      );
      return;
    }

    const script = document.createElement('script');
    script.src = CREDIT_DIRECT_SCRIPT_URL;
    script.type = 'text/javascript';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error('Failed to load Credit Direct script'));
    document.head.appendChild(script);
  });
}

/**
 * Open Credit Direct checkout popup
 *
 * Flow:
 * 1. Call server to sign the transaction
 * 2. Load Credit Direct SDK
 * 3. Open popup with signed config
 */
export async function openCreditDirectCheckout(
  options: CreditDirectCheckoutOptions
): Promise<void> {
  const {
    merchantSlug,
    orderId,
    amount,
    trackingToken,
    customerEmail,
    customerPhone,
    items,
    onSuccess,
    onClose,
    onError,
    onPopup,
  } = options;

  try {
    const { totalAmount: requestedTotalAmount } = prepareCreditDirectAmounts(
      items,
      amount
    );

    // Step 1: Get signature from server
    const signResponse = await fetch('/api/payments/credit-direct/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerEmail,
        totalAmount: requestedTotalAmount,
        merchantSlug,
        orderId,
        trackingToken,
      }),
    });

    if (!signResponse.ok) {
      const errorData = await signResponse.json();
      throw new Error(errorData.error || 'Failed to initialize Credit Direct');
    }

    const signData: SignResponse = await signResponse.json();

    if (signData.error) {
      throw new Error(signData.error);
    }

    // Step 2: Load the Credit Direct script
    await loadCreditDirectScript();

    if (!window.Connect) {
      throw new Error('Credit Direct SDK failed to load');
    }

    // Step 3: Build transaction object from the SERVER-signed amount only. Fail
    // closed when it is absent or invalid: falling back to the caller-supplied
    // `amount` would put a client-controlled total in the popup (and diverge
    // from the HMAC signature) on a stale or partial signing response.
    const signedAmount = signData.amount;
    if (!Number.isFinite(signedAmount) || signedAmount <= 0) {
      throw new Error('Credit Direct signing response has an invalid amount');
    }
    const { products, totalAmount } = prepareCreditDirectAmounts(
      items,
      signedAmount
    );
    const transaction: CreditDirectTransaction = {
      totalAmount,
      customerEmail,
      customerPhone: customerPhone || '',
      sessionId: signData.sessionId,
      metaData: orderId, // Store orderId for webhook reconciliation
      // Credit Direct requires totalAmount to equal the exact sum of products.
      // Allocate shipping, tax, discounts and pre-gateway credits across the
      // order lines in minor units so both checkout and webhook totals agree.
      products,
    };

    // Step 4: Open checkout popup
    console.log('Initializing Credit Direct Connect with:', {
      publicKey: signData.publicKey ? 'Present' : 'Missing',
      signature: signData.signature ? 'Present' : 'Missing',
      sessionId: signData.sessionId,
      isLive: signData.isLive,
    });

    let checkoutCompleted = false;
    const resolveReference = (
      response?: CreditDirectSdkPayload
    ): CreditDirectCheckoutReference => ({
      checkoutTransactionId: response?.checkoutTransactionId?.trim() || null,
      sessionId: signData.sessionId,
    });

    const checkout = new window.Connect({
      publicKey: signData.publicKey,
      signature: signData.signature,
      transaction,
      isLive: signData.isLive,
      onSuccess: (response) => {
        console.log('Credit Direct checkout success');
        checkoutCompleted = true;
        onSuccess(resolveReference(response));
      },
      onClose: () => {
        if (checkoutCompleted) {
          console.log('Credit Direct checkout closed after completion');
          return;
        }
        console.log('Credit Direct checkout closed');
        onClose();
      },
      onPopup: (response) => {
        const popupTransactionId = response?.checkoutTransactionId?.trim();
        console.log(
          'Credit Direct popup opened:',
          popupTransactionId || 'No checkout transaction ID returned'
        );
        onPopup?.(resolveReference(response));
      },
    });

    checkout.setup();
    checkout.open();
  } catch (error) {
    console.error('Credit Direct checkout error:', error);
    onError(error instanceof Error ? error.message : 'Checkout failed');
  }
}

/**
 * Check if an amount is eligible for Credit Direct BNPL
 */
export function isCreditDirectEligible(
  amount: number,
  minAmount: number = 10000,
  maxAmount: number = 5000000
): boolean {
  return amount >= minAmount && amount <= maxAmount;
}
