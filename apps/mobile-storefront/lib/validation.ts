/**
 * Zod Validation Schemas
 * Centralized validation for auth, checkout, and forms
 * Matches database constraints for Supabase parity
 *
 * 2025 Best Practices:
 * - Use z.infer<typeof Schema> for type inference
 * - Export both schema AND inferred type
 * - Use branded types for domain-specific values
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
  firstName: z
    .string()
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name is too long'),
  lastName: z
    .string()
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name is too long'),
  phone: NigerianPhoneSchema,
  address: z
    .string()
    .min(5, 'Address must be at least 5 characters')
    .max(255, 'Address is too long'),
  city: z
    .string()
    .min(2, 'City must be at least 2 characters')
    .max(100, 'City name is too long'),
  state: z.string().min(1, 'Please select a state'),
  notes: z.string().max(500, 'Notes are too long').optional(),
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
