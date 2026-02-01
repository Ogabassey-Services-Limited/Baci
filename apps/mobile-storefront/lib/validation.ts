/**
 * Zod Validation Schemas
 * Centralized validation for auth, checkout, and forms
 * Matches database constraints for Supabase parity
 *
 * 2026 Best Practices:
 * - Use z.infer<typeof Schema> for type inference
 * - Export both schema AND inferred type
 * - Use branded types for domain-specific values
 * - Clear, user-friendly error messages
 * - Real-time validation feedback
 */

import { z } from 'zod';

// ============================================
// AUTH SCHEMAS
// ============================================

export const EmailSchema = z
  .string()
  .min(1, 'Email address is required')
  .email('Please enter a valid email address')
  .max(255, 'Email is too long');

export const OtpSchema = z
  .string()
  .length(6, 'Verification code must be 6 digits')
  .regex(/^\d{6}$/, 'Verification code must be numbers only');

// ============================================
// CHECKOUT SCHEMAS
// ============================================

// Nigerian phone number validation
// Accepts: 08012345678, +2348012345678, 2348012345678
const NigerianPhoneSchema = z
  .string()
  .min(1, 'Phone number is required')
  .refine(
    (phone) => {
      // Remove spaces and dashes
      const cleaned = phone.replace(/[\s-]/g, '');
      // Nigerian phone patterns
      const patterns = [
        /^0[789][01]\d{8}$/, // 08012345678, 09012345678, 07012345678
        /^\+234[789][01]\d{8}$/, // +2348012345678
        /^234[789][01]\d{8}$/, // 2348012345678
      ];
      return patterns.some((pattern) => pattern.test(cleaned));
    },
    {
      message: 'Please enter a valid Nigerian phone number (e.g., 08012345678)',
    }
  );

export const ShippingAddressSchema = z.object({
  // 2026 Best Practice: Clear, actionable error messages
  firstName: z
    .string()
    .min(1, 'Please enter your first name')
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name is too long (max 50 characters)'),
  lastName: z
    .string()
    .min(1, 'Please enter your last name')
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name is too long (max 50 characters)'),
  phone: NigerianPhoneSchema,
  address: z
    .string()
    .min(1, 'Please enter your delivery address')
    .min(5, 'Please provide a more detailed address')
    .max(255, 'Address is too long (max 255 characters)'),
  city: z
    .string()
    .min(1, 'Please enter your city')
    .min(2, 'City name must be at least 2 characters')
    .max(100, 'City name is too long (max 100 characters)'),
  state: z.string().min(1, 'Please select your state'),
  notes: z
    .string()
    .max(500, 'Delivery notes are too long (max 500 characters)')
    .optional(),
});

export type ShippingAddressInput = z.infer<typeof ShippingAddressSchema>;

// ============================================
// PRODUCT SCHEMAS
// ============================================

export const QuantitySchema = z
  .number()
  .int('Quantity must be a whole number')
  .min(1, 'Quantity must be at least 1')
  .max(99, 'Maximum quantity is 99');

// ============================================
// PROFILE SCHEMAS
// ============================================

export const ProfileSchema = z.object({
  firstName: z
    .string()
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name is too long'),
  lastName: z
    .string()
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name is too long'),
  phone: NigerianPhoneSchema.optional().or(z.literal('')),
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Parse and validate data, returning formatted errors
 */
export function validateWithSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown
):
  | { success: true; data: T }
  | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  // Convert Zod errors to a simple key-value object
  const errors: Record<string, string> = {};
  result.error.issues.forEach((issue) => {
    const path = issue.path.join('.');
    if (!errors[path]) {
      errors[path] = issue.message;
    }
  });

  return { success: false, errors };
}

/**
 * Get first error message from Zod result
 */
export function getFirstError<T>(
  result: z.ZodSafeParseResult<T>
): string | null {
  if (result.success) return null;
  return result.error.issues[0]?.message || 'Validation failed';
}

// ============================================
// COMMERCE BRAIN SCHEMAS (2025 Best Practice: Typed API calls)
// ============================================

export const CalculateOrderInput = z.object({
  subtotal: z.number().positive(),
  shippingFee: z.number().min(0).optional(),
  taxRate: z.number().min(0).max(1).optional(),
});

export const CalculateOrderOutput = z.object({
  taxAmount: z.number(),
  total: z.number(),
});

export const CalculateVTUInput = z.object({
  amount: z.number().positive(),
  provider: z.string(),
  category: z.enum(['AIRTIME', 'DATA']).optional(),
  merchantSplit: z.number().min(0).max(100).optional(),
});

export const CalculateVTUOutput = z.object({
  platformEarning: z.number(),
  merchantEarning: z.number(),
  totalCommission: z.number(),
  commissionRate: z.number(),
});

export const RedeemLoyaltyInput = z.object({
  points: z.number().int().positive(),
  currentPoints: z.number().int().min(0),
  pointsToNairaRate: z.number().positive().optional(),
});

export const RedeemLoyaltyOutput = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  pointsRedeemed: z.number().optional(),
  walletCredit: z.number().optional(),
  remainingPoints: z.number().optional(),
  conversionRate: z.number().optional(),
  minRedeemPoints: z.number().optional(),
});

// Export inferred types
export type CalculateOrderInputType = z.infer<typeof CalculateOrderInput>;
export type CalculateOrderOutputType = z.infer<typeof CalculateOrderOutput>;
export type CalculateVTUInputType = z.infer<typeof CalculateVTUInput>;
export type CalculateVTUOutputType = z.infer<typeof CalculateVTUOutput>;
export type RedeemLoyaltyInputType = z.infer<typeof RedeemLoyaltyInput>;
export type RedeemLoyaltyOutputType = z.infer<typeof RedeemLoyaltyOutput>;

// ============================================
// API RESPONSE SCHEMAS (2026 Best Practice: Runtime validation)
// ============================================

/**
 * Reviews API response schema
 */
export const ReviewSchema = z.object({
  id: z.string(),
  rating: z.number().min(1).max(5),
  title: z.string().optional(),
  body: z.string().optional(),
  customer_name: z.string(),
  verified_purchase: z.boolean(),
  helpful_count: z.number().default(0),
  created_at: z.string(),
});

export const ReviewStatsSchema = z.object({
  average_rating: z.number(),
  review_count: z.number(),
  rating_distribution: z.record(z.string(), z.number()),
});

export const ReviewsApiResponseSchema = z.object({
  reviews: z.array(ReviewSchema).default([]),
  stats: ReviewStatsSchema.optional(),
  pagination: z
    .object({
      page: z.number(),
      limit: z.number(),
      totalPages: z.number(),
      totalCount: z.number(),
    })
    .optional(),
});

export type Review = z.infer<typeof ReviewSchema>;
export type ReviewStats = z.infer<typeof ReviewStatsSchema>;
export type ReviewsApiResponse = z.infer<typeof ReviewsApiResponseSchema>;

/**
 * Mark review helpful response schema
 */
export const MarkReviewHelpfulResponseSchema = z.object({
  success: z.boolean(),
  helpfulCount: z.number(),
});

export type MarkReviewHelpfulResponse = z.infer<
  typeof MarkReviewHelpfulResponseSchema
>;

/**
 * IMEI Check API response schema
 */
export const ImeiResultSchema = z.object({
  imei: z.string(),
  device: z.string(),
  modelNumber: z.string(),
  status: z.enum(['Clean', 'Blacklisted', 'Unknown']),
  icloud: z.string(),
  icloudLock: z.string(),
  simLock: z.string(),
  blacklistStatus: z.string(),
  carrier: z.string(),
  deviceImage: z.string(),
  score: z.number(),
  deviceType: z.enum(['apple', 'android', 'other']),
  verdict: z.string(),
  verdictType: z.enum(['safe', 'caution', 'danger']),
});

export const ImeiCheckApiResponseSchema = z.object({
  success: z.boolean(),
  data: ImeiResultSchema.optional(),
  error: z.string().optional(),
});

export type ImeiResult = z.infer<typeof ImeiResultSchema>;
export type ImeiCheckApiResponse = z.infer<typeof ImeiCheckApiResponseSchema>;

/**
 * AI Device Grade (Swap/Trade-in) response schema
 */
export const AIAnalysisResultSchema = z.object({
  model: z.string(),
  grade: z.enum(['Excellent', 'Good', 'Fair', 'Poor']),
  observations: z.array(z.string()),
  basePrice: z.number(),
  estimatedValue: z.number(),
  deductionPercent: z.number(),
});

export const AIGradeDeviceApiResponseSchema = z.object({
  success: z.boolean().optional(),
  data: AIAnalysisResultSchema.optional(),
  error: z.string().optional(),
});

export type AIAnalysisResult = z.infer<typeof AIAnalysisResultSchema>;
export type AIGradeDeviceApiResponse = z.infer<
  typeof AIGradeDeviceApiResponseSchema
>;

/**
 * Negotiation API response schema
 */
export const NegotiationResultSchema = z.object({
  status: z.enum(['accepted', 'counter', 'rejected', 'final']),
  counterOffer: z.number().optional(),
  originalPrice: z.number(),
  offeredPrice: z.number(),
  message: z.string(),
  attemptNumber: z.number(),
  canContinue: z.boolean(),
});

export type NegotiationResult = z.infer<typeof NegotiationResultSchema>;

/**
 * Supabase Database Row Types for type-safe queries
 * 2026 Best Practice: Type guards for realtime payloads
 */

// Merchant row from Supabase
export const MerchantRowSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().optional(),
  name: z.string().optional(),
});

export type MerchantRow = z.infer<typeof MerchantRowSchema>;

// Customer row from Supabase
export const CustomerRowSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
  loyalty_points: z.number().nullable().optional(),
  loyalty_tier: z.string().nullable().optional(),
});

export type CustomerRow = z.infer<typeof CustomerRowSchema>;

// Order row from Supabase (for realtime updates)
export const OrderRowSchema = z.object({
  id: z.string().uuid(),
  order_number: z.string().nullable().optional(),
  status: z.string().optional(),
  total: z.number().optional(),
  payment_status: z.string().optional(),
  shipping_status: z.string().optional(),
  tracking_number: z.string().nullable().optional(),
  tracking_url: z.string().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type OrderRow = z.infer<typeof OrderRowSchema>;

// Product row from Supabase query
export const ProductRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable().optional(),
  price: z.number(),
  compare_at_price: z.number().nullable().optional(),
  images: z.array(z.string()).nullable().optional(),
  brand: z.string().nullable().optional(),
  condition: z.string().nullable().optional(),
  status: z.string().optional(),
  specifications: z.record(z.string(), z.string()).nullable().optional(),
  has_variants: z.boolean().nullable().optional(),
  variant_attributes: z
    .record(z.string(), z.array(z.string()))
    .nullable()
    .optional(),
  categories: z
    .union([
      z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          slug: z.string(),
        })
      ),
      z.object({
        id: z.string(),
        name: z.string(),
        slug: z.string(),
      }),
    ])
    .nullable()
    .optional(),
});

export type ProductRow = z.infer<typeof ProductRowSchema>;

// Wallet row from Supabase
export const WalletRowSchema = z.object({
  balance: z.number().default(0),
});

export type WalletRow = z.infer<typeof WalletRowSchema>;

// Transaction row from Supabase
export const TransactionRowSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['credit', 'debit']),
  amount: z.number(),
  description: z.string(),
  created_at: z.string(),
});

export type TransactionRow = z.infer<typeof TransactionRowSchema>;

// ============================================
// TYPE GUARDS FOR REALTIME PAYLOADS
// 2026 Best Practice: Runtime type checking for realtime data
// ============================================

/**
 * Type guard for Supabase realtime payload
 * Validates that payload.new contains expected structure
 */
export function isOrderRealtimePayload(
  payload: unknown
): payload is { new: OrderRow; old: OrderRow | null } {
  if (typeof payload !== 'object' || payload === null) return false;
  const p = payload as Record<string, unknown>;
  if (!('new' in p) || typeof p.new !== 'object' || p.new === null)
    return false;
  const result = OrderRowSchema.safeParse(p.new);
  return result.success;
}

/**
 * Type guard for wallet realtime payload
 */
export function isWalletRealtimePayload(
  payload: unknown
): payload is { new: WalletRow; old: WalletRow | null } {
  if (typeof payload !== 'object' || payload === null) return false;
  const p = payload as Record<string, unknown>;
  if (!('new' in p) || typeof p.new !== 'object' || p.new === null)
    return false;
  const result = WalletRowSchema.safeParse(p.new);
  return result.success;
}

/**
 * Type guard for customer realtime payload
 */
export function isCustomerRealtimePayload(
  payload: unknown
): payload is { new: CustomerRow; old: CustomerRow | null } {
  if (typeof payload !== 'object' || payload === null) return false;
  const p = payload as Record<string, unknown>;
  if (!('new' in p) || typeof p.new !== 'object' || p.new === null)
    return false;
  const result = CustomerRowSchema.safeParse(p.new);
  return result.success;
}

/**
 * Safe parser for API responses with logging
 */
export function parseApiResponse<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context?: string
): T | null {
  const result = schema.safeParse(data);
  if (!result.success) {
    // Use separate arguments to avoid format string injection
    console.warn(
      'API response validation failed',
      context ? `(${context})` : '',
      result.error.issues
    );
    return null;
  }
  return result.data;
}
