/**
 * Juicyway Type Definitions, Constants & Zod Schemas
 */

import z from 'zod';

// =============================================================================
// Constants (with const assertions for type safety)
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
  'crypto_address',
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

export const JUICYWAY_CRYPTO_CHAINS = ['TRX', 'ETH', 'MATIC', 'AVAXC'] as const;
export type JuicywayCryptoChain = (typeof JUICYWAY_CRYPTO_CHAINS)[number];

export const JUICYWAY_STABLECOINS = ['USDT', 'USDC'] as const;
export type JuicywayStablecoin = (typeof JUICYWAY_STABLECOINS)[number];

export const JUICYWAY_CHAIN_SUPPORT: Record<
  JuicywayStablecoin,
  JuicywayCryptoChain[]
> = {
  USDT: ['TRX', 'ETH', 'MATIC', 'AVAXC'],
  USDC: ['ETH', 'MATIC', 'AVAXC'],
};

// =============================================================================
// Zod Schemas for Runtime Validation
// =============================================================================

export const BillingAddressSchema = z.object({
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().optional(),
  country: z.string().length(2),
  zip_code: z.string().min(1),
});

export const CustomerSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.email(),
  phone_number: z.string().regex(/^\+\d{10,15}$/),
  billing_address: BillingAddressSchema,
  type: z.enum(['individual', 'business']).optional(),
  ip_address: z
    .string()
    .regex(
      /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/
    ),
});

export const PaymentMethodSchema = z.object({
  type: z.enum(JUICYWAY_PAYMENT_METHODS),
  account_name: z.string().optional(),
  account_number: z.string().optional(),
  bank_name: z.string().optional(),
});

export const PaymentSessionResponseSchema = z.object({
  id: z.string().optional(),
  amount: z.number().optional(),
  currency: z.string().optional(),
  status: z.enum(JUICYWAY_STATUSES).optional(),
  customer: CustomerSchema.optional(),
  payment_method: PaymentMethodSchema.optional(),
  description: z.string().optional(),
  reference: z.string().optional(),
  mode: z.enum(['test', 'live']).optional(),
  checkout_url: z.url().optional(),
  date: z.string().optional(),
  auth_type: z.enum(JUICYWAY_AUTH_TYPES).optional(),
  expires_at: z.string().optional(),
  links: z
    .object({
      redirect_url: z.url().optional(),
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
// TypeScript Interfaces
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
  amount: number;
  currency: JuicywayCurrency;
  customer: JuicywayCustomer;
  description: string;
  reference: string;
  payment_method: { type: JuicywayPaymentMethodType };
  order: JuicywayOrder;
  metadata?: Record<string, unknown>;
  redirect_url?: string;
  direction?: 'incoming' | 'outgoing';
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

export interface JuicywayCryptoPaymentRequest {
  chain: JuicywayCryptoChain;
  currency: JuicywayStablecoin;
}

export interface JuicywayCryptoPaymentResponse {
  id: string;
  status: string;
  message?: string;
  payment: {
    id: string;
    currency: string;
    amount: number;
    payment_method: {
      type: 'crypto_address';
      /** Direct address (docs example) */
      address?: string;
      chain?: JuicywayCryptoChain;
      currency?: JuicywayStablecoin;
      qrcode?: string;
      /** Nested address (live API structure) */
      params?: {
        address: string;
        chain: string;
        currency: string;
      };
    };
    status: string;
  };
}

/** Loose shape for payment_method from any Juicyway endpoint */
interface CryptoPaymentMethodLike {
  address?: string;
  chain?: string;
  currency?: string;
  qrcode?: string;
  params?: { address: string; chain: string; currency: string };
}

/**
 * Extract crypto address from Juicyway payment_method response.
 * The API returns the address either at the top level or nested under `params`.
 */
export function extractCryptoAddress(
  pm: CryptoPaymentMethodLike | undefined | null
): {
  address: string;
  chain: string;
  currency: string;
  qrcode?: string;
} | null {
  if (!pm) return null;
  const address = pm.address || pm.params?.address;
  if (!address) return null;
  return {
    address,
    chain: pm.chain || pm.params?.chain || '',
    currency: pm.currency || pm.params?.currency || '',
    qrcode: pm.qrcode,
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

export interface JuicywayApiResponse<T> {
  data?: T;
  message?: string;
  status?: string;
  links?: { redirect_url?: string };
  payment?: { id: string; status: string };
}
