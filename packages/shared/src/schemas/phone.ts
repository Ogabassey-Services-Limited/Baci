import { z } from 'zod';

/**
 * Nigerian phone number validation schema
 * Matches Baci 2026 Best Practices:
 * - Specific, user-friendly error messages
 * - Support for both local (080...) and international (+234...) formats
 */
export const NigerianPhoneSchema = z
  .string()
  .min(1, 'Phone number is required')
  .refine(
    (phone) => {
      // Remove spaces, dashes, dots, and parentheses
      const cleaned = phone.replace(/[\s\-().]/g, '');

      // Nigerian phone patterns (2026 Optimized)
      const patterns = [
        /^0[789][01]\d{8}$/, // Local: 08012345678
        /^\+234[789][01]\d{8}$/, // Int'l with +: +2348012345678
        /^234[789][01]\d{8}$/, // Int'l without +: 2348012345678
        /^[789][01]\d{8}$/, // 10-digit without leading 0: 8031234567
      ];

      return patterns.some((pattern) => pattern.test(cleaned));
    },
    {
      error: 'Please enter a valid Nigerian phone number (e.g., 08012345678)',
    }
  );

/**
 * Helper to validate a Nigerian phone number
 * Useful for one-off checks outside of Zod forms
 */
export function isValidNigerianPhone(phone: string): boolean {
  if (!phone) return false;
  return NigerianPhoneSchema.safeParse(phone).success;
}

/**
 * Inferred type for Nigerian phone number
 */
export type NigerianPhone = z.infer<typeof NigerianPhoneSchema>;
