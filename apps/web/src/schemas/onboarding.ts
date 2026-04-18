import z from 'zod';
import { sanitizePhone, sanitizeText, sanitizeUrl } from '@/lib/sanitize-core';
import {
  checkPasswordStrength,
  isCommonPassword,
  MIN_ACCEPTABLE_PASSWORD_STRENGTH,
} from '@/lib/utils';

/**
 * --- PREPROCESSOR HELPERS ---
 */

const _preprocessText = (val: unknown) =>
  typeof val === 'string' ? sanitizeText(val) : val;
const _preprocessEmail = (val: unknown) =>
  typeof val === 'string' ? val.toLowerCase().trim() : val;
const _preprocessPhone = (val: unknown) =>
  typeof val === 'string' ? sanitizePhone(sanitizeText(val)) : val;
const INVALID_URL_SENTINEL = '__invalid_url__';
const _preprocessUrl = (val: unknown) => {
  if (typeof val !== 'string') return val;
  const trimmed = sanitizeText(val);
  const sanitized = sanitizeUrl(trimmed);
  if (!trimmed) return '';
  return sanitized || INVALID_URL_SENTINEL;
};

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
      // Handle empty string early
      if (val.trim() === '') return undefined;
      const sanitized = sanitizeText(val);
      // Normalize to URL-safe slug: lowercase, replace spaces/special chars with hyphens
      const result = sanitized
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      // Return undefined if sanitization resulted in empty string
      return result === '' ? undefined : result;
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
    z.union([z.string().trim().url(), z.literal('')]).optional()
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
  ctx: z.RefinementCtx,
  options?: {
    allowConfirmPasswordPrefix?: boolean;
  }
) => {
  const { password, confirmPassword } = data;
  const allowConfirmPasswordPrefix =
    options?.allowConfirmPasswordPrefix === true;

  if (password && password.length > 0) {
    if (password.length < 8) {
      ctx.addIssue({
        code: 'custom',
        path: ['password'],
        message: 'Password must be at least 8 characters.',
      });
    }

    const strength = checkPasswordStrength(password);
    if (strength < MIN_ACCEPTABLE_PASSWORD_STRENGTH) {
      ctx.addIssue({
        code: 'custom',
        path: ['password'],
        message:
          'Password is too weak. Add more characters or mix letters, numbers, and symbols.',
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

    if (strength < MIN_ACCEPTABLE_PASSWORD_STRENGTH) {
      return;
    }

    if (!confirmPassword) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirmPassword'],
        message: 'Please confirm your password.',
      });
    } else if (password !== confirmPassword) {
      const isPrefixInProgress =
        allowConfirmPasswordPrefix &&
        confirmPassword.length < password.length &&
        password.startsWith(confirmPassword);

      if (isPrefixInProgress) {
        return;
      }

      ctx.addIssue({
        code: 'custom',
        path: ['confirmPassword'],
        message: 'Passwords do not match.',
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
      .refine((val) => val.length > 0, { message })
      .refine((val) => val !== INVALID_URL_SENTINEL, {
        message: 'Invalid logo URL. Please provide a valid URL.',
      })
  );

const createWebOnboardingSchema = (options?: {
  allowConfirmPasswordPrefix?: boolean;
}) =>
  step1BaseSchema
    .merge(step2BaseSchema)
    .merge(step3BaseSchema)
    .extend({
      logoUrl: createRequiredLogoUrl(
        'Logo is required for web setup. Please upload or generate one.'
      ),
    })
    .superRefine((data, ctx) => {
      refineStep1Other(data, ctx);
      refineStep3Password(data, ctx, options);
    });

/**
 * --- PLATFORM SPECIFIC SCHEMAS (2026 Best Practice: Composition) ---
 */

/**
 * Web Onboarding Schema: STRICT
 * Requires logoUrl for full branding setup.
 */
export const onboardingSchema = createWebOnboardingSchema();

/**
 * Web Onboarding Form Schema: RELAXED CONFIRM PASSWORD
 * Keeps the live form from flashing mismatch errors while a user is still
 * typing the confirm-password field. Server-side submit validation still uses
 * onboardingSchema, which requires an exact match.
 */
export const onboardingFormSchema = createWebOnboardingSchema({
  allowConfirmPasswordPrefix: true,
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
