/**
 * Credit Direct BNPL (Buy Now Pay Later) Integration
 *
 * Enables customers to split payments into installments.
 * Credit Direct pays merchants in full, customers repay Credit Direct over time.
 *
 * Integration docs: https://github.com/lenda-saas/vanilla-javascript-for-checkout
 */

import crypto from 'node:crypto';

// ============================================================================
// Types
// ============================================================================

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

export interface CreditDirectCheckoutConfig {
  publicKey: string;
  signature: string;
  transaction: CreditDirectTransaction;
  isLive: boolean;
  onSuccess: () => void;
  onClose: () => void;
  onPopup: (response: { checkoutTransactionId: string }) => void;
}

export interface CreditDirectWebhookPayload {
  checkoutCustomer: {
    firstName: string;
    lastName: string;
  };
  checkoutTransactionId: string;
  eventType:
    | 'Checkout_Customer_Payment_Completed'
    | 'Checkout_Merchant_Payment_Completed';
  metaData: string | null;
  products: CreditDirectProduct[];
  timeStamp: string;
}

export type CreditDirectWebhookEvent =
  | 'Checkout_Customer_Payment_Completed'
  | 'Checkout_Merchant_Payment_Completed';

// ============================================================================
// Configuration
// ============================================================================

export const CREDIT_DIRECT_CONFIG = {
  checkoutScriptUrl: 'https://checkout.creditdirect.ng/bnpl/checkout.min.js',
  // Default amount limits (in NGN)
  defaultMinAmount: 10000,
  defaultMaxAmount: 5000000,
  minAmount: 10000, // Alias for easier access
  maxAmount: 5000000, // Alias for easier access
};

// ============================================================================
// Transaction Signing
// ============================================================================

/**
 * Sign a Credit Direct transaction using HMAC-SHA256
 *
 * The signature is computed as: HMAC-SHA256(sessionId + customerEmail + totalAmount, privateKey)
 *
 * @param sessionId - Unique session identifier for this transaction
 * @param customerEmail - Customer's email address
 * @param totalAmount - Total transaction amount in NGN
 * @param privateKey - Merchant's private key from Credit Direct dashboard
 * @returns Hex-encoded signature string
 */
export function signTransaction(
  sessionId: string,
  customerEmail: string,
  totalAmount: number,
  privateKey: string
): string {
  const message = `${sessionId}${customerEmail}${totalAmount}`;
  const hmac = crypto.createHmac('sha256', privateKey);
  hmac.update(message);
  return hmac.digest('hex');
}

// ============================================================================
// Session ID Generation
// ============================================================================

/**
 * Generate a unique session ID for Credit Direct checkout
 *
 * @param length - Length of the session ID (default: 15)
 * @returns Random alphanumeric string
 */
export function generateSessionId(length: number = 15): string {
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomValues = new Uint32Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    result += characters.charAt(randomValues[i] % characters.length);
  }
  return result;
}

// ============================================================================
// Webhook Verification
// ============================================================================

/**
 * Verify Credit Direct webhook signature
 *
 * @param payload - Raw webhook payload string
 * @param signature - Signature from webhook header
 * @param secret - Webhook secret from Credit Direct dashboard
 * @returns Whether the signature is valid
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
}

/**
 * Parse and validate a Credit Direct webhook payload
 *
 * @param payload - Raw webhook payload
 * @returns Parsed webhook payload or null if invalid
 */
export function parseWebhookPayload(
  payload: unknown
): CreditDirectWebhookPayload | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const p = payload as Record<string, unknown>;

  // Validate required fields
  if (
    !p.checkoutTransactionId ||
    !p.eventType ||
    !p.timeStamp ||
    !p.checkoutCustomer
  ) {
    return null;
  }

  // Validate event type
  const validEvents: CreditDirectWebhookEvent[] = [
    'Checkout_Customer_Payment_Completed',
    'Checkout_Merchant_Payment_Completed',
  ];
  if (!validEvents.includes(p.eventType as CreditDirectWebhookEvent)) {
    return null;
  }

  return payload as CreditDirectWebhookPayload;
}

// ============================================================================
// Checkout Configuration
// ============================================================================

/**
 * Build the checkout configuration object for Credit Direct popup
 *
 * @param params - Checkout parameters
 * @returns Configuration object for Credit Direct Connect
 */
export function buildCheckoutConfig(params: {
  publicKey: string;
  signature: string;
  transaction: CreditDirectTransaction;
  isLive: boolean;
  onSuccess?: () => void;
  onClose?: () => void;
  onPopup?: (response: { checkoutTransactionId: string }) => void;
}): CreditDirectCheckoutConfig {
  return {
    publicKey: params.publicKey,
    signature: params.signature,
    transaction: params.transaction,
    isLive: params.isLive,
    onSuccess:
      params.onSuccess ||
      (() => {
        /* default no-op */
      }),
    onClose:
      params.onClose ||
      (() => {
        /* default no-op */
      }),
    onPopup:
      params.onPopup ||
      (() => {
        /* default no-op */
      }),
  };
}

/**
 * Get the Credit Direct checkout script URL
 */
export function getCheckoutScriptUrl(): string {
  return CREDIT_DIRECT_CONFIG.checkoutScriptUrl;
}

// ============================================================================
// Amount Validation
// ============================================================================

/**
 * Check if an order amount is eligible for Credit Direct BNPL
 *
 * @param amount - Order total in NGN
 * @param minAmount - Minimum eligible amount (default: 10,000 NGN)
 * @param maxAmount - Maximum eligible amount (default: 500,000 NGN)
 * @returns Whether the amount qualifies for BNPL
 */
export function isAmountEligible(
  amount: number,
  minAmount: number = CREDIT_DIRECT_CONFIG.defaultMinAmount,
  maxAmount: number = CREDIT_DIRECT_CONFIG.defaultMaxAmount
): boolean {
  return amount >= minAmount && amount <= maxAmount;
}

// ============================================================================
// Environment Helpers
// ============================================================================

/**
 * Get Credit Direct private key from environment
 */
export function getPrivateKey(): string {
  const key = process.env.CREDIT_DIRECT_PRIVATE_KEY;
  if (!key) {
    throw new Error(
      'CREDIT_DIRECT_PRIVATE_KEY environment variable is not set'
    );
  }
  return key;
}

/**
 * Get Credit Direct public key from environment
 */
export function getPublicKey(): string {
  const key = process.env.CREDIT_DIRECT_PUBLIC_KEY;
  if (!key) {
    throw new Error('CREDIT_DIRECT_PUBLIC_KEY environment variable is not set');
  }
  return key;
}

/**
 * Get Credit Direct webhook secret from environment
 */
export function getWebhookSecret(): string {
  const secret = process.env.CREDIT_DIRECT_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      'CREDIT_DIRECT_WEBHOOK_SECRET environment variable is not set'
    );
  }
  return secret;
}

/**
 * Check if Credit Direct is in live mode.
 * Defaults to true — live keys are rejected by the test server.
 * Set CREDIT_DIRECT_IS_LIVE=false explicitly to use test mode with test keys.
 */
export function isLiveMode(): boolean {
  return process.env.CREDIT_DIRECT_IS_LIVE !== 'false';
}

// ============================================================================
// Platform Fee Calculation
// ============================================================================

/**
 * Calculate platform fee for Credit Direct transactions
 *
 * Note: Credit Direct pays merchants in full. This is for Baci's platform fee.
 *
 * @param amount - Transaction amount in NGN
 * @returns Platform fee amount
 */
export function calculatePlatformFee(amount: number): number {
  // 2% platform fee, capped at 2,050 NGN (same as other gateways)
  const fee = amount * 0.02;
  const cap = 2050;
  return Math.min(fee, cap);
}

/**
 * Calculate merchant amount after platform fee
 *
 * @param amount - Transaction amount in NGN
 * @returns Amount merchant receives after platform fee
 */
export function calculateMerchantAmount(amount: number): number {
  return amount - calculatePlatformFee(amount);
}
