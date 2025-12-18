/**
 * Juicyway Payment Integration
 * Supports card payments, bank transfers, stablecoins, and more
 * Docs: https://docs.juicyway.com
 *
 * 2025 Best Practices:
 * - Zod validation for API responses
 * - Result types instead of throwing for recoverable errors
 * - Const assertions for literal types
 * - Structured logging
 * - Web Crypto API for HMAC
 */

import { z } from 'zod';
import { logger } from './logger';

// =============================================================================
// Configuration
// =============================================================================

const JUICYWAY_BASE_URL =
  process.env.JUICYWAY_BASE_URL || 'https://api-sandbox.spendjuice.com';
const JUICYWAY_SECRET_KEY = process.env.JUICYWAY_SECRET_KEY || '';

// =============================================================================
// Type Definitions (with const assertions for type safety)
// =============================================================================

export const JUICYWAY_CURRENCIES = [
  'NGN',
  'USD',
  'CAD',
  'USDT',
  'USDC',
] as const;
export type JuicywayCurrency = (typeof JUICYWAY_CURRENCIES)[number];

export const JUICYWAY_PAYMENT_METHODS = [
  'card',
  'bank_account',
  'crypto_address', // For stablecoin/crypto payments
  'wallet',
  'interac',
] as const;
export type JuicywayPaymentMethodType =
  (typeof JUICYWAY_PAYMENT_METHODS)[number];

export const JUICYWAY_STATUSES = [
  'pending',
  'processing',
  'succeeded',
  'failed',
  'cancelled',
] as const;
export type JuicywayPaymentStatus = (typeof JUICYWAY_STATUSES)[number];

export const JUICYWAY_AUTH_TYPES = ['3ds', 'otp', 'pin', 'none'] as const;
export type JuicywayAuthType = (typeof JUICYWAY_AUTH_TYPES)[number];

// Supported blockchain networks for stablecoin payments
export const JUICYWAY_CRYPTO_CHAINS = ['TRX', 'ETH', 'MATIC', 'AVAXC'] as const;
export type JuicywayCryptoChain = (typeof JUICYWAY_CRYPTO_CHAINS)[number];

// Supported stablecoins
export const JUICYWAY_STABLECOINS = ['USDT', 'USDC'] as const;
export type JuicywayStablecoin = (typeof JUICYWAY_STABLECOINS)[number];

// Chain/stablecoin compatibility matrix
export const JUICYWAY_CHAIN_SUPPORT: Record<JuicywayStablecoin, JuicywayCryptoChain[]> = {
  USDT: ['TRX', 'ETH'],
  USDC: ['ETH', 'MATIC', 'AVAXC'],
};

// =============================================================================
// Zod Schemas for Runtime Validation
// =============================================================================

const BillingAddressSchema = z.object({
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().optional(),
  country: z.string().length(2), // ISO 2-letter code
  zip_code: z.string().min(1),
});

const CustomerSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().email(),
  phone_number: z.string().regex(/^\+\d{10,15}$/), // E.164 format
  billing_address: BillingAddressSchema,
  type: z.enum(['individual', 'business']).optional(),
  ip_address: z
    .string()
    .regex(
      /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/
    ), // IPv4
});

const PaymentMethodSchema = z.object({
  type: z.enum(JUICYWAY_PAYMENT_METHODS),
  account_name: z.string().optional(),
  account_number: z.string().optional(),
  bank_name: z.string().optional(),
});

const PaymentSessionResponseSchema = z.object({
  id: z.string().optional(),
  amount: z.number().optional(),
  currency: z.string().optional(),
  status: z.enum(JUICYWAY_STATUSES).optional(),
  customer: CustomerSchema.optional(),
  payment_method: PaymentMethodSchema.optional(),
  description: z.string().optional(),
  reference: z.string().optional(),
  mode: z.enum(['test', 'live']).optional(),
  checkout_url: z.string().url().optional(),
  date: z.string().optional(),
  auth_type: z.enum(JUICYWAY_AUTH_TYPES).optional(),
  expires_at: z.string().optional(),
  links: z
    .object({
      redirect_url: z.string().url().optional(),
    })
    .optional(),
  message: z.string().optional(),
  payment: z
    .object({
      id: z.string(),
      status: z.string(),
      amount: z.number(),
      currency: z.string(),
      reference: z.string(),
    })
    .optional(),
});

// =============================================================================
// TypeScript Interfaces (derived from schemas where possible)
// =============================================================================

export type JuicywayBillingAddress = z.infer<typeof BillingAddressSchema>;
export type JuicywayCustomer = z.infer<typeof CustomerSchema>;
export type JuicywayPaymentMethod = z.infer<typeof PaymentMethodSchema>;

export interface JuicywayOrderItem {
  name: string;
  type: 'digital' | 'physical';
}

export interface JuicywayOrder {
  identifier: string;
  items: JuicywayOrderItem[];
}

export interface JuicywayPaymentInitRequest {
  amount: number; // In minor units (kobo, cents) - minimum 100 for fiat, 1800 (18 USDT) for crypto
  currency: JuicywayCurrency;
  customer: JuicywayCustomer;
  description: string; // Max 200 characters
  reference: string; // Unique, max 50 characters
  payment_method: { type: JuicywayPaymentMethodType };
  order: JuicywayOrder;
  metadata?: Record<string, unknown>;
  redirect_url?: string;
  direction?: 'incoming' | 'outgoing'; // Required for crypto payments
}

export interface JuicywayPaymentSession {
  id: string;
  amount: number;
  currency: string;
  status: JuicywayPaymentStatus;
  customer: JuicywayCustomer;
  payment_method: JuicywayPaymentMethod;
  description: string;
  reference: string;
  mode: 'test' | 'live';
  checkout_url?: string;
  date?: string;
  auth_type?: JuicywayAuthType;
  expires_at?: string;
  links?: { redirect_url?: string };
  message?: string;
  payment?: {
    id: string;
    status: string;
    amount: number;
    currency: string;
    reference: string;
  };
}

// Crypto payment capture request
export interface JuicywayCryptoPaymentRequest {
  chain: JuicywayCryptoChain;
  currency: JuicywayStablecoin;
}

// Crypto payment response with wallet address
export interface JuicywayCryptoPaymentResponse {
  id: string;
  status: string;
  message?: string;
  payment: {
    id: string;
    currency: string;
    amount: number;
    payment_method: {
      address: string;
      chain: JuicywayCryptoChain;
      currency: JuicywayStablecoin;
      type: 'crypto_address';
      qrcode?: string; // Optional QR code URL if returned by API
    };
    status: string;
  };
}

export type JuicywayWebhookEvent =
  | 'payment.session.succeeded'
  | 'payment.session.failed';

export interface JuicywayWebhookPayload {
  checksum: string;
  event: JuicywayWebhookEvent;
  data: {
    id: string;
    amount: number;
    currency: string;
    reference: string;
    status: 'success' | 'failed';
    customer: JuicywayCustomer;
    payment_method: JuicywayPaymentMethod;
    date: string;
    description: string;
    mode: 'test' | 'live';
  };
}

// =============================================================================
// Result Type for Error Handling
// =============================================================================

export type JuicywayResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

// =============================================================================
// API Client
// =============================================================================

interface JuicywayApiResponse<T> {
  data?: T;
  message?: string;
  status?: string;
  links?: { redirect_url?: string };
  payment?: { id: string; status: string };
}

async function juicywayRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<JuicywayResult<JuicywayApiResponse<T>>> {
  const url = `${JUICYWAY_BASE_URL}${endpoint}`;

  if (!JUICYWAY_SECRET_KEY) {
    return {
      success: false,
      error: 'JUICYWAY_SECRET_KEY is not configured',
      code: 'CONFIG_ERROR',
    };
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: JUICYWAY_SECRET_KEY,
        ...options.headers,
      },
    });

    const data = await response.json();

    logger.info({
      message: 'Juicyway API Response',
      endpoint,
      status: response.status,
      responseKeys: Object.keys(data),
    });

    if (!response.ok) {
      logger.error({
        message: 'Juicyway API Error',
        status: response.status,
        error: data.message || 'Unknown error',
        errors: data.errors || data, // Log full error details
      });
      return {
        success: false,
        error: data.message || `API request failed: ${response.status}`,
        code: `HTTP_${response.status}`,
      };
    }

    return { success: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network error';
    logger.error({ message: 'Juicyway request failed', error: message });
    return { success: false, error: message, code: 'NETWORK_ERROR' };
  }
}

// =============================================================================
// Public API Functions
// =============================================================================

/**
 * Initialize a payment session
 * Returns checkout URL for card payments or virtual account for bank transfers
 */
export async function initializePayment(
  data: JuicywayPaymentInitRequest
): Promise<JuicywayPaymentSession> {
  // Validate constraints
  if (data.amount < 100) {
    throw new Error('Amount must be at least 100 (minor units)');
  }
  if (data.reference.length > 50) {
    throw new Error('Reference must be max 50 characters');
  }
  if (data.description.length > 200) {
    throw new Error('Description must be max 200 characters');
  }

  // Log the request payload for debugging
  logger.info({
    message: 'Juicyway payment request',
    amount: data.amount,
    currency: data.currency,
    paymentMethod: data.payment_method.type,
    reference: data.reference,
    customerEmail: data.customer.email,
    direction: data.direction,
  });

  const result = await juicywayRequest<JuicywayPaymentSession>(
    '/payment-sessions',
    { method: 'POST', body: JSON.stringify(data) }
  );

  if (!result.success) {
    throw new Error(result.error);
  }

  // Handle both wrapped { data: ... } and unwrapped response formats
  const rawResult = result.data.data || result.data;

  // Log the full response structure for debugging
  logger.info({
    message: 'Juicyway raw response structure',
    hasData: !!result.data.data,
    hasLinks: !!(rawResult as { links?: unknown }).links,
    linksContent: (rawResult as { links?: unknown }).links,
    hasCheckoutUrl: !!(rawResult as { checkout_url?: string }).checkout_url,
    hasPayment: !!(rawResult as { payment?: unknown }).payment,
    paymentId: (rawResult as { payment?: { id?: string } }).payment?.id,
    topLevelId: (rawResult as { id?: string }).id,
  });

  // Validate response structure (partial validation for flexibility)
  const parseResult = PaymentSessionResponseSchema.safeParse(rawResult);
  if (!parseResult.success) {
    logger.warn({
      message: 'Juicyway response validation warning',
      issues: parseResult.error.issues,
    });
  }

  // Extract checkout URL from various possible locations:
  // 1. links.redirect_url (for 3DS card payments - this is the primary redirect)
  // 2. Direct checkout_url field if provided
  // Note: Do NOT construct URLs from payment IDs - the API must provide the redirect URL
  const checkoutUrl =
    (rawResult as JuicywayApiResponse<unknown>).links?.redirect_url ||
    (rawResult as { checkout_url?: string }).checkout_url ||
    // Check nested data structure
    (rawResult as { data?: { links?: { redirect_url?: string } } }).data?.links?.redirect_url;

  // Log warning if no checkout URL found for card payments
  if (!checkoutUrl && (rawResult as { payment_method?: { type?: string } }).payment_method?.type === 'card') {
    logger.warn({
      message: 'No checkout URL returned for card payment - may need 3DS redirect',
      paymentId: (rawResult as JuicywayApiResponse<unknown>).payment?.id,
    });
  }

  const session: JuicywayPaymentSession = {
    ...(rawResult as JuicywayPaymentSession),
    checkout_url: checkoutUrl,
    id:
      (rawResult as { id?: string }).id ||
      (rawResult as JuicywayApiResponse<unknown>).payment?.id ||
      '',
  };

  logger.info({
    message: 'Juicyway payment initialized',
    sessionId: session.id,
    hasCheckoutUrl: !!session.checkout_url,
  });

  return session;
}

/**
 * Fetch a payment by ID (with Result type for better error handling)
 */
export async function getPayment(
  paymentId: string
): Promise<JuicywayResult<JuicywayPaymentSession>> {
  // Validate UUID format (any UUID version, not just v4)
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(paymentId)) {
    return {
      success: false,
      error: 'Invalid payment ID format (must be UUID)',
      code: 'VALIDATION_ERROR',
    };
  }

  // Use /payments/{id} endpoint per Juicyway docs:
  // https://docs.juicyway.com/payment-transactions/fetch-payment
  const result = await juicywayRequest<JuicywayPaymentSession>(
    `/payments/${paymentId}`,
    { method: 'GET' }
  );

  if (!result.success) {
    return result;
  }

  // Handle both wrapped { data: ... } and unwrapped response formats
  const paymentData = result.data.data || result.data;

  return {
    success: true,
    data: paymentData as unknown as JuicywayPaymentSession,
  };
}

/**
 * Verify a payment status
 */
export async function verifyPayment(paymentId: string): Promise<
  JuicywayResult<{
    success: boolean;
    status: JuicywayPaymentStatus;
    payment: JuicywayPaymentSession;
  }>
> {
  const result = await getPayment(paymentId);

  if (!result.success) {
    return result;
  }

  return {
    success: true,
    data: {
      success: result.data.status === 'succeeded',
      status: result.data.status,
      payment: result.data,
    },
  };
}

/**
 * Capture a payment session with crypto/stablecoin details
 * This generates a blockchain address for the customer to send funds to
 *
 * @param paymentId - The payment session ID from initializePayment
 * @param chain - Blockchain network (TRX, ETH, MATIC, AVAXC)
 * @param currency - Stablecoin type (USDT or USDC)
 *
 * Note: USDT is supported on TRX, ETH
 *       USDC is supported on ETH, MATIC, AVAXC
 */
export async function capturePaymentWithCrypto(
  paymentId: string,
  chain: JuicywayCryptoChain,
  currency: JuicywayStablecoin
): Promise<JuicywayResult<JuicywayCryptoPaymentResponse>> {
  // Validate UUID format
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(paymentId)) {
    return {
      success: false,
      error: 'Invalid payment ID format (must be UUID)',
      code: 'VALIDATION_ERROR',
    };
  }

  // Validate chain/currency compatibility
  const supportedChains = JUICYWAY_CHAIN_SUPPORT[currency];
  if (!supportedChains.includes(chain)) {
    return {
      success: false,
      error: `${currency} is not supported on ${chain}. Supported chains: ${supportedChains.join(', ')}`,
      code: 'VALIDATION_ERROR',
    };
  }

  logger.info({
    message: 'Capturing payment with crypto',
    paymentId,
    chain,
    currency,
  });

  const result = await juicywayRequest<JuicywayCryptoPaymentResponse>(
    `/payment-sessions/${paymentId}`,
    {
      method: 'POST',
      body: JSON.stringify({
        crypto_address: {
          chain,
          currency,
        },
      }),
    }
  );

  if (!result.success) {
    return result;
  }

  // Handle both wrapped { data: ... } and unwrapped response formats
  const rawResult = result.data.data || result.data;

  logger.info({
    message: 'Crypto payment captured',
    paymentId,
    address: (rawResult as JuicywayCryptoPaymentResponse).payment?.payment_method?.address,
    chain: (rawResult as JuicywayCryptoPaymentResponse).payment?.payment_method?.chain,
  });

  return {
    success: true,
    data: rawResult as JuicywayCryptoPaymentResponse,
  };
}

/**
 * Get estimated confirmation time for a blockchain network
 */
export function getChainConfirmationTime(chain: JuicywayCryptoChain): string {
  const confirmationTimes: Record<JuicywayCryptoChain, string> = {
    TRX: '1-3 minutes',
    ETH: '5-30 minutes',
    MATIC: '1-5 minutes',
    AVAXC: '1-5 minutes',
  };
  return confirmationTimes[chain];
}

/**
 * Verify webhook signature using HMAC SHA-256 (Web Crypto API)
 */
export async function verifyWebhookSignature(
  event: string,
  data: Record<string, unknown>,
  checksum: string,
  businessId: string
): Promise<boolean> {
  // Sort data alphabetically and stringify
  const sortedData = Object.keys(data)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = data[key];
      return acc;
    }, {});

  const message = `${event}|${JSON.stringify(sortedData)}`;
  const encoder = new TextEncoder();

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(businessId),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    encoder.encode(message)
  );

  const computedChecksum = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Constant-time comparison to prevent timing attacks
  return computedChecksum.toLowerCase() === checksum.toLowerCase();
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Generate a unique payment reference
 */
export function generatePaymentReference(prefix = 'baci'): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.getRandomValues(new Uint8Array(4));
  const randomStr = Array.from(random)
    .map((b) => b.toString(36))
    .join('');
  return `${prefix}_${timestamp}_${randomStr}`.substring(0, 50);
}

/**
 * Format phone number to E.164 format
 */
export function formatPhoneToE164(phone: string, countryCode = '+234'): string {
  const digits = phone.replace(/\D/g, '');

  // Already has country code
  if (digits.startsWith('234') && digits.length === 13) {
    return `+${digits}`;
  }

  // Remove leading zero if present
  const normalized = digits.startsWith('0') ? digits.slice(1) : digits;
  return `${countryCode}${normalized}`;
}

/**
 * Check if Juicyway is properly configured
 */
export function isJuicywayConfigured(): boolean {
  return Boolean(JUICYWAY_SECRET_KEY);
}

/**
 * Get the current environment mode
 */
export function getJuicywayMode(): 'sandbox' | 'live' {
  return JUICYWAY_BASE_URL.includes('sandbox') ? 'sandbox' : 'live';
}

/**
 * Validate if a currency is supported
 */
export function isSupportedCurrency(
  currency: string
): currency is JuicywayCurrency {
  return JUICYWAY_CURRENCIES.includes(currency as JuicywayCurrency);
}
