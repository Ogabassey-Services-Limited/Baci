/**
 * Paystack Payment Integration
 * Supports payments, subaccounts, and bank verification for Nigeria
 *
 * 2025 Best Practices:
 * - Zod validation for API responses
 * - Result types for recoverable errors
 * - Const assertions for literal types
 * - Structured logging
 * - Input validation with SSRF prevention
 */

import { z } from 'zod';
import { logger } from './logger';

// =============================================================================
// Configuration
// =============================================================================

const PAYSTACK_BASE_URL = 'https://api.paystack.co';
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';

// Platform fee percentage (2%) capped at ₦2,050
const PLATFORM_FEE_PERCENTAGE = 2;
const PLATFORM_FEE_CAP_NAIRA = 2050;
const PLATFORM_FEE_CAP_KOBO = PLATFORM_FEE_CAP_NAIRA * 100;

// =============================================================================
// Type Definitions
// =============================================================================

const PAYMENT_STATUSES = ['success', 'failed', 'abandoned', 'pending'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

const PAYMENT_CHANNELS = [
  'card',
  'bank',
  'ussd',
  'qr',
  'mobile_money',
  'bank_transfer',
] as const;
export type PaymentChannel = (typeof PAYMENT_CHANNELS)[number];

// =============================================================================
// Zod Schemas
// =============================================================================

const BankSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  code: z.string(),
  longcode: z.string(),
  gateway: z.string().nullable(),
  pay_with_bank: z.boolean(),
  active: z.boolean(),
  is_deleted: z.boolean(),
  country: z.string(),
  currency: z.string(),
  type: z.string(),
});

const ResolvedAccountSchema = z.object({
  account_number: z.string(),
  account_name: z.string(),
  bank_id: z.number().optional(),
});

const SubaccountResponseSchema = z.object({
  id: z.number(),
  subaccount_code: z.string(),
  business_name: z.string(),
  description: z.string().nullable(),
  primary_contact_name: z.string().nullable(),
  primary_contact_email: z.string().nullable(),
  primary_contact_phone: z.string().nullable(),
  percentage_charge: z.number(),
  settlement_bank: z.string(),
  account_number: z.string(),
});

const PaymentInitResponseSchema = z.object({
  authorization_url: z.string().url(),
  access_code: z.string(),
  reference: z.string(),
});

const CustomerSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  customer_code: z.string(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  phone: z.string().nullable(),
});

const PaymentVerificationSchema = z.object({
  id: z.number(),
  status: z.enum(PAYMENT_STATUSES),
  reference: z.string(),
  amount: z.number(),
  currency: z.string(),
  channel: z.string(),
  paid_at: z.string().nullable(),
  created_at: z.string(),
  customer: CustomerSchema,
  metadata: z.record(z.string(), z.unknown()).nullable(),
  fees: z.number(),
  fees_split: z
    .object({
      paystack: z.number(),
      integration: z.number(),
      subaccount: z.number(),
    })
    .nullable(),
});

// =============================================================================
// TypeScript Interfaces
// =============================================================================

export type Bank = z.infer<typeof BankSchema>;
export type SubaccountResponse = z.infer<typeof SubaccountResponseSchema>;
export type PaymentInitResponse = z.infer<typeof PaymentInitResponseSchema>;
export type PaymentVerificationResponse = z.infer<
  typeof PaymentVerificationSchema
>;

export interface Subaccount {
  business_name: string;
  settlement_bank: string;
  account_number: string;
  percentage_charge: number;
  description?: string;
  primary_contact_email?: string;
  primary_contact_name?: string;
  primary_contact_phone?: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentInitData {
  email: string;
  amount: number; // Amount in kobo (NGN smallest unit)
  reference?: string;
  callback_url?: string;
  metadata?: Record<string, unknown>;
  subaccount?: string; // Subaccount code for split payments
  transaction_charge?: number; // Platform fee in kobo
  bearer?: 'account' | 'subaccount'; // Who bears the transaction charges
  channels?: PaymentChannel[];
}

// =============================================================================
// Result Type
// =============================================================================

export type PaystackResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

// =============================================================================
// API Client
// =============================================================================

interface PaystackApiResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

async function paystackRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<PaystackResult<T>> {
  const url = `${PAYSTACK_BASE_URL}${endpoint}`;

  if (!PAYSTACK_SECRET_KEY) {
    return {
      success: false,
      error: 'PAYSTACK_SECRET_KEY is not configured',
      code: 'CONFIG_ERROR',
    };
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        ...options.headers,
      },
    });

    const data: PaystackApiResponse<T> = await response.json();

    logger.info({
      message: 'Paystack API Response',
      endpoint,
      status: response.status,
      success: data.status,
    });

    if (!response.ok || !data.status) {
      logger.error({
        message: 'Paystack API Error',
        status: response.status,
        error: data.message,
      });
      return {
        success: false,
        error: data.message || `API request failed: ${response.status}`,
        code: `HTTP_${response.status}`,
      };
    }

    return { success: true, data: data.data };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network error';
    logger.error({ message: 'Paystack request failed', error: message });
    return { success: false, error: message, code: 'NETWORK_ERROR' };
  }
}

// =============================================================================
// Bank Functions
// =============================================================================

/**
 * Fetch list of banks from Paystack
 */
export async function getBanks(country = 'nigeria'): Promise<Bank[]> {
  const result = await paystackRequest<Bank[]>(
    `/bank?country=${encodeURIComponent(country)}`
  );

  if (!result.success) {
    logger.error({ message: 'Failed to fetch banks', error: result.error });
    return [];
  }

  // Validate and filter valid banks
  const validBanks = result.data.filter(
    (bank) => BankSchema.safeParse(bank).success
  );
  return validBanks;
}

/**
 * Resolve account number to verify name
 */
export async function resolveAccountNumber(
  accountNumber: string,
  bankCode: string
): Promise<PaystackResult<{ account_number: string; account_name: string }>> {
  // Validate inputs
  if (!accountNumber || !bankCode) {
    return {
      success: false,
      error: 'Account number and bank code are required',
      code: 'VALIDATION_ERROR',
    };
  }

  if (!/^\d{10}$/.test(accountNumber)) {
    return {
      success: false,
      error: 'Account number must be 10 digits',
      code: 'VALIDATION_ERROR',
    };
  }

  if (!/^\d{3}$/.test(bankCode)) {
    return {
      success: false,
      error: 'Bank code must be 3 digits',
      code: 'VALIDATION_ERROR',
    };
  }

  const result = await paystackRequest<{
    account_number: string;
    account_name: string;
  }>(`/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`);

  if (!result.success) {
    return result;
  }

  const parsed = ResolvedAccountSchema.safeParse(result.data);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Invalid account resolution response',
      code: 'VALIDATION_ERROR',
    };
  }

  return { success: true, data: result.data };
}

// =============================================================================
// Subaccount Functions
// =============================================================================

/**
 * Create a subaccount for a merchant
 */
export async function createSubaccount(
  payload: Subaccount
): Promise<PaystackResult<SubaccountResponse>> {
  // Validate required fields
  if (
    !payload.business_name ||
    !payload.settlement_bank ||
    !payload.account_number
  ) {
    return {
      success: false,
      error: 'Missing required subaccount fields',
      code: 'VALIDATION_ERROR',
    };
  }

  const result = await paystackRequest<SubaccountResponse>('/subaccount', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!result.success) {
    return result;
  }

  const parsed = SubaccountResponseSchema.safeParse(result.data);
  if (!parsed.success) {
    logger.warn({
      message: 'Subaccount response validation warning',
      issues: parsed.error.issues,
    });
  }

  return { success: true, data: result.data };
}

/**
 * Update a subaccount
 */
export async function updateSubaccount(
  subaccountCode: string,
  payload: Partial<Subaccount>
): Promise<PaystackResult<SubaccountResponse>> {
  // Validate subaccount code format (e.g., ACCT_xxxxx)
  if (!subaccountCode || !/^ACCT_[a-z0-9]+$/i.test(subaccountCode)) {
    return {
      success: false,
      error: 'Invalid subaccount code format',
      code: 'VALIDATION_ERROR',
    };
  }

  const result = await paystackRequest<SubaccountResponse>(
    `/subaccount/${encodeURIComponent(subaccountCode)}`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    }
  );

  return result;
}

// =============================================================================
// Payment Functions
// =============================================================================

/**
 * Initialize a Paystack transaction
 */
export async function initializeTransaction(
  payload: PaymentInitData
): Promise<PaymentInitResponse> {
  // Validate required fields
  if (!payload.email || !payload.amount) {
    throw new Error('Email and amount are required');
  }

  if (payload.amount < 100) {
    throw new Error('Amount must be at least 100 kobo (₦1)');
  }

  const result = await paystackRequest<PaymentInitResponse>(
    '/transaction/initialize',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );

  if (!result.success) {
    throw new Error(result.error);
  }

  // Validate response
  const parsed = PaymentInitResponseSchema.safeParse(result.data);
  if (!parsed.success) {
    logger.warn({
      message: 'Payment init response validation warning',
      issues: parsed.error.issues,
    });
  }

  return result.data;
}

/**
 * Verify a Paystack transaction
 */
export async function verifyTransaction(
  reference: string
): Promise<PaystackResult<PaymentVerificationResponse>> {
  // Validate reference format to prevent SSRF attacks
  // Paystack references are typically alphanumeric with some special chars
  if (!reference || !/^[A-Za-z0-9_-]{1,100}$/.test(reference)) {
    return {
      success: false,
      error: 'Invalid transaction reference format',
      code: 'VALIDATION_ERROR',
    };
  }

  const result = await paystackRequest<PaymentVerificationResponse>(
    `/transaction/verify/${encodeURIComponent(reference)}`
  );

  if (!result.success) {
    return result;
  }

  // Validate response
  const parsed = PaymentVerificationSchema.safeParse(result.data);
  if (!parsed.success) {
    logger.warn({
      message: 'Payment verification response validation warning',
      issues: parsed.error.issues,
    });
  }

  return { success: true, data: result.data };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Calculate platform fee for split payments
 * Platform takes 2%, capped at ₦2,050
 * Amount should be in kobo
 */
export function calculatePlatformFee(amountInKobo: number): {
  platformFee: number; // in kobo
  merchantAmount: number; // in kobo
  total: number; // in kobo
} {
  let platformFee = Math.round((amountInKobo * PLATFORM_FEE_PERCENTAGE) / 100);
  platformFee = Math.min(platformFee, PLATFORM_FEE_CAP_KOBO);

  const merchantAmount = amountInKobo - platformFee;

  return {
    platformFee,
    merchantAmount,
    total: amountInKobo,
  };
}

/**
 * Get Paystack public key for frontend
 */
export function getPublicKey(): string {
  return process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '';
}

/**
 * Check if Paystack is properly configured
 */
export function isPaystackConfigured(): boolean {
  return Boolean(PAYSTACK_SECRET_KEY);
}

/**
 * Validate payment channel
 */
export function isValidChannel(channel: string): channel is PaymentChannel {
  return PAYMENT_CHANNELS.includes(channel as PaymentChannel);
}

export { PLATFORM_FEE_PERCENTAGE };
