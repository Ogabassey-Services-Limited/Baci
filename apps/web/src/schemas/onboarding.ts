import z from 'zod';
import {
  sanitizeEmail,
  sanitizePhone,
  sanitizeText,
  sanitizeUrl,
} from '@/lib/sanitize-core';
import { checkPasswordStrength, isCommonPassword } from '@/lib/utils';

/**
 * --- PREPROCESSOR HELPERS ---
 */

const _preprocessText = (val: unknown) =>
  typeof val === 'string' ? sanitizeText(val) : val;
const _preprocessEmail = (val: unknown) =>
  typeof val === 'string' ? sanitizeEmail(sanitizeText(val)) : val;
const _preprocessPhone = (val: unknown) =>
  typeof val === 'string' ? sanitizePhone(sanitizeText(val)) : val;
const _preprocessUrl = (val: unknown) =>
  typeof val === 'string' ? sanitizeUrl(val) : val;

/**
 * --- SHARED BASE SCHEMAS ---
 * These define the primitive fields for each step.
 */

const step1BaseSchema = z.object({
  businessName: z.preprocess(
    _preprocessText,
    z
      .string()
      .trim()
      .min(2, { message: 'Business name must be at least 2 characters.' })
  ),
  businessType: z.preprocess(
    _preprocessText,
    z.string().trim().min(1, { message: 'Please select a business type.' })
  ),
  otherBusinessType: z.preprocess(
    _preprocessText,
    z.string().trim().optional()
  ),
  slug: z.preprocess(
    (val) => {
      if (typeof val !== 'string') return val;
      const sanitized = sanitizeText(val);
      // Normalize to URL-safe slug: lowercase, replace spaces/special chars with hyphens
      return sanitized
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    },
    z
      .string()
      .trim()
      .min(3, { message: 'Store link must be at least 3 characters.' })
      .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, {
        message:
          'Store link must contain only lowercase letters, numbers, and hyphens.',
      })
      .optional()
  ),
});

const step2BaseSchema = z.object({
  logoUrl: z.preprocess(
    _preprocessUrl,
    z.string().trim().optional().or(z.literal(''))
  ),
  brandColors: z.preprocess(
    _preprocessText,
    z.string().trim().min(1, { message: 'Brand colors are required.' })
  ),
  brandPreferences: z.preprocess(_preprocessText, z.string().trim().optional()),
});

const step3BaseSchema = z.object({
  email: z.preprocess(
    _preprocessEmail,
    z.string().trim().email({ message: 'Please enter a valid email address.' })
  ),
  password: z.string().optional(),
  confirmPassword: z.string().optional(),
  firstName: z.preprocess(_preprocessText, z.string().trim().optional()),
  lastName: z.preprocess(_preprocessText, z.string().trim().optional()),
  phone: z.preprocess(_preprocessPhone, z.string().trim().optional()),
});

/**
 * --- REUSABLE REFINEMENTS ---
 */

const refineStep1Other = (
  data: {
    businessType: string;
    otherBusinessType?: string;
  },
  ctx: z.RefinementCtx
) => {
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
};

const refineStep3Password = (
  data: {
    password?: string;
    confirmPassword?: string;
  },
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

/**
 * --- SHARED FIELD SCHEMAS ---
 */

const createRequiredLogoUrl = (message: string) =>
  z.preprocess(
    _preprocessUrl,
    z
      .string()
      .trim()
      .min(1, { message })
      .url({ message: 'Invalid logo URL. Please provide a valid URL.' })
  );

/**
 * --- PLATFORM SPECIFIC SCHEMAS (2026 Best Practice: Composition) ---
 */

/**
 * Web Onboarding Schema: STRICT
 * Requires logoUrl for full branding setup.
 */
export const onboardingSchema = step1BaseSchema
  .merge(step2BaseSchema)
  .merge(step3BaseSchema)
  .extend({
    logoUrl: createRequiredLogoUrl(
      'Logo is required for web setup. Please upload or generate one.'
    ),
  })
  .superRefine((data, ctx) => {
    refineStep1Other(data, ctx);
    refineStep3Password(data, ctx);
  });

/**
 * Mobile Onboarding Schema: FLEXIBLE
 * Allows logoUrl to be optional for quick registration.
 */
export const mobileOnboardingSchema = step1BaseSchema
  .merge(step2BaseSchema)
  .merge(step3BaseSchema)
  .superRefine((data, ctx) => {
    refineStep1Other(data, ctx);
    refineStep3Password(data, ctx);
  });

/**
 * --- STEP-WISE SCHEMAS (For UI Form Progress) ---
 */

export const step1Schema = step1BaseSchema.superRefine(refineStep1Other);

export const step2Schema = step2BaseSchema.extend({
  logoUrl: createRequiredLogoUrl(
    'Logo is required for step validation. Please upload or generate one.'
  ),
});

export const step3Schema = step3BaseSchema.superRefine(refineStep3Password);

export type OnboardingFormValues = z.infer<typeof onboardingSchema>;
export type MobileOnboardingValues = z.infer<typeof mobileOnboardingSchema>;
