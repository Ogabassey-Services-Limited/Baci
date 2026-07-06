/**
 * Credit Direct BNPL - Client-side checkout helpers
 *
 * This module handles the browser-side popup checkout flow.
 * Server-side signing is done via /api/payments/credit-direct/sign
 */

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

export interface CreditDirectCheckoutOptions {
  merchantSlug: string;
  orderId: string;
  amount: number;
  customerEmail: string;
  customerPhone: string;
  customerName: string;
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  onSuccess: (transactionId: string) => void;
  onClose: () => void;
  onError: (error: string) => void;
  onPopup?: (transactionId: string) => void;
}

interface SignResponse {
  signature: string;
  publicKey: string;
  sessionId: string;
  isLive: boolean;
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
    customerEmail,
    customerPhone,
    items,
    onSuccess,
    onClose,
    onError,
    onPopup,
  } = options;

  try {
    // Step 1: Get signature from server
    const signResponse = await fetch('/api/payments/credit-direct/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerEmail,
        totalAmount: amount,
        merchantSlug,
        orderId,
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

    // Step 3: Build transaction object
    const transaction: CreditDirectTransaction = {
      totalAmount: amount,
      customerEmail,
      customerPhone: customerPhone || '',
      sessionId: signData.sessionId,
      metaData: orderId, // Store orderId for webhook reconciliation
      products: items.map((item) => ({
        productId: item.id,
        productName: item.name,
        productAmount: item.price * item.quantity,
      })),
    };

    // Step 4: Open checkout popup
    console.log('Initializing Credit Direct Connect with:', {
      publicKey: signData.publicKey ? 'Present' : 'Missing',
      signature: signData.signature ? 'Present' : 'Missing',
      sessionId: signData.sessionId,
      isLive: signData.isLive,
    });

    let checkoutCompleted = false;
    const resolveTransactionId = (response?: CreditDirectSdkPayload) => {
      const transactionId = response?.checkoutTransactionId?.trim();
      return transactionId || signData.sessionId;
    };

    const checkout = new window.Connect({
      publicKey: signData.publicKey,
      signature: signData.signature,
      transaction,
      isLive: signData.isLive,
      onSuccess: (response) => {
        console.log('Credit Direct checkout success');
        checkoutCompleted = true;
        onSuccess(resolveTransactionId(response));
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
          popupTransactionId || 'No ID returned (using session id)'
        );
        // Fall back to the signing sessionId (same fallback onSuccess uses):
        // the popup handoff must always be observable so the launcher can
        // record it before the popup replaces the document in a WebView.
        onPopup?.(resolveTransactionId(response));
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
