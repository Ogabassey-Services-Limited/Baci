import { z } from 'zod';
import { checkPasswordStrength, isCommonPassword } from '@/lib/utils';

/**
 * Base schema for Step 1. Contains only field definitions.
 */
const step1BaseSchema = z.object({
  businessName: z
    .string()
    .trim()
    .min(2, { message: 'Business name must be at least 2 characters.' }),
  businessType: z
    .string()
    .trim()
    .min(1, { message: 'Please select a business type.' }),
  otherBusinessType: z.string().trim().optional(),
  slug: z.string().trim().min(3, { message: 'Store link must be at least 3 characters.' }).optional(),
});

/**
 * Step 1: Business Details (with client-side refinement)
 */
export const step1Schema = step1BaseSchema.refine(
  (data) => {
    if (
      data.businessType === 'other' &&
      (!data.otherBusinessType || data.otherBusinessType.length < 2)
    ) {
      return false;
    }
    return true;
  },
  {
    message:
      "If you select 'Other', please specify your business type with at least 2 characters.",
    path: ['otherBusinessType'],
  }
);

/**
 * Step 2: Branding (Client-side validation)
 */
export const step2Schema = z.object({
  logoUrl: z
    .string()
    .trim()
    .min(1, { message: 'Logo is required. Please upload or generate one.' }),
  brandColors: z.string().trim().min(1, { message: 'Brand colors are required.' }),
  brandPreferences: z.string().trim().optional(),
});

/**
 * Base schema for Step 3. Contains only field definitions.
 */
const step3BaseSchema = z.object({
  email: z.string().trim().email({ message: 'Please enter a valid email address.' }),
  password: z.string().optional(),
  confirmPassword: z.string().optional(),
});

/**
 * Step 3: Account Creation (with client-side refinement + breach checking)
 * Uses superRefine for proper conditional validation:
 * - If password is provided, it must be at least 8 chars and strong enough
 * - If password is strong enough (>= 2 strength), confirmPassword must match
 * - Password is checked against common/breached passwords
 * Note: The form component handles the "password required" logic for non-logged-in users
 */
// Reusable password validation helper
const validatePassword = (
  data: { password?: string; confirmPassword?: string },
  ctx: z.RefinementCtx
) => {
  const { password, confirmPassword } = data;

  if (password && password.length > 0) {
    if (password.length < 8) {
      ctx.addIssue({
        code: 'custom',
        path: ['password'],
        message: 'Password must be at least 8 characters.',
      });
    }

    const strength = checkPasswordStrength(password);
    if (strength < 2) {
      ctx.addIssue({
        code: 'custom',
        path: ['password'],
        message:
          'Password is too weak. Add more characters or mix letters, numbers, and symbols.',
      });
    }

    if (!confirmPassword) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirmPassword'],
        message: 'Please confirm your password.',
      });
    } else if (password !== confirmPassword) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirmPassword'],
        message: 'Passwords do not match.',
      });
    }

    if (isCommonPassword(password)) {
      ctx.addIssue({
        code: 'custom',
        path: ['password'],
        message:
          'This password is too common. Please choose a more unique password.',
      });
    }
  }
};

export const step3Schema = step3BaseSchema.superRefine((data, ctx) => {
  validatePassword(data, ctx);
});

/**
 * Combined schema for final server-side validation.
 * This merges the base schemas first, then applies all refinements.
 */
export const onboardingSchema = step1BaseSchema
  .merge(step2Schema)
  .merge(step3BaseSchema)
  .superRefine((data, ctx) => {
    // Refinement from step1Schema
    if (
      data.businessType === 'other' &&
      (!data.otherBusinessType || data.otherBusinessType.length < 2)
    ) {
      ctx.addIssue({
        code: 'custom',
        message:
          "If you select 'Other', please specify your business type with at least 2 characters.",
        path: ['otherBusinessType'],
      });
    }

    // Refinement from step3Schema (Password Validation)
    validatePassword(data, ctx);
  });

export type OnboardingFormValues = z.infer<typeof onboardingSchema>;
