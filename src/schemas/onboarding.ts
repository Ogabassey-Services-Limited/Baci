import { z } from 'zod';
import { checkPasswordStrength, isCommonPassword } from '@/lib/utils';

/**
 * Base schema for Step 1. Contains only field definitions.
 */
const step1BaseSchema = z.object({
  businessName: z
    .string()
    .min(2, { error: 'Business name must be at least 2 characters.' }),
  businessType: z.string().min(1, { error: 'Please select a business type.' }),
  otherBusinessType: z.string().optional(),
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
    error:
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
    .min(1, { message: 'Logo is required. Please upload or generate one.' }),
  brandColors: z.string().min(1, { error: 'Brand colors are required.' }),
  brandPreferences: z.string().optional(),
});

/**
 * Base schema for Step 3. Contains only field definitions.
 */
const step3BaseSchema = z.object({
  email: z.string().email({ error: 'Please enter a valid email address.' }),
  password: z
    .union([
      z.string().min(8, { error: 'Password must be at least 8 characters.' }),
      z.literal(''),
    ])
    .optional(),
  confirmPassword: z.string().optional(),
});

/**
 * Step 3: Account Creation (with client-side refinement + breach checking)
 */
export const step3Schema = step3BaseSchema
  .refine(
    (data) => {
      if (data.password && checkPasswordStrength(data.password || '') >= 2) {
        return data.password === data.confirmPassword;
      }
      return true;
    },
    {
      error: 'Passwords do not match.',
      path: ['confirmPassword'],
    }
  )
  .superRefine(async (data, ctx) => {
    if (data.password && data.password.length >= 8) {
      // Check for common passwords first (instant, no network)
      if (isCommonPassword(data.password)) {
        ctx.addIssue({
          code: 'custom',
          path: ['password'],
          message:
            'This password is too common. Please choose a more unique password.',
        });
        return; // Don't bother with breach check if it's common
      }

      // Check for breached passwords
      try {
        const { checkPasswordBreach } = await import('@/lib/password-breach');
        const { isBreached } = await checkPasswordBreach(data.password);
        if (isBreached) {
          ctx.addIssue({
            code: 'custom',
            path: ['password'],
            message:
              'This password has been compromised in a data breach. Please choose a different password.',
          });
        }
      } catch (error) {
        // Fail open - if check fails, allow password
        console.error('Breach check failed:', error);
      }
    }
  });

/**
 * Combined schema for final server-side validation.
 * This merges the base schemas first, then applies all refinements.
 */
export const onboardingSchema = step1BaseSchema
  .merge(step2Schema)
  .merge(step3BaseSchema)
  .refine(
    (data) => {
      // Refinement from step1Schema
      if (
        data.businessType === 'other' &&
        (!data.otherBusinessType || data.otherBusinessType.length < 2)
      ) {
        return false;
      }
      return true;
    },
    {
      error: "If you select 'Other', please specify your business type.",
      path: ['otherBusinessType'],
    }
  )
  .refine(
    (data) => {
      // Refinement from step3Schema
      if (data.password) {
        return data.password === data.confirmPassword;
      }
      return true;
    },
    {
      error: 'Passwords do not match.',
      path: ['confirmPassword'],
    }
  );

export type OnboardingFormValues = z.infer<typeof onboardingSchema>;
