/**
 * Form Validation Schemas
 *
 * 2026 Best Practices:
 * - Zod for runtime validation
 * - Type inference from schemas
 * - Reusable validation patterns
 */

import { z } from 'zod';
import { VALIDATION_ERROR_MESSAGES } from './error-messages';

/**
 * Email validation schema
 */
export const emailSchema = z
  .string()
  .min(1, VALIDATION_ERROR_MESSAGES.emailRequired)
  .email(VALIDATION_ERROR_MESSAGES.emailInvalid);

/**
 * Password validation schema
 */
export const passwordSchema = z
  .string()
  .min(1, VALIDATION_ERROR_MESSAGES.passwordRequired)
  .min(6, VALIDATION_ERROR_MESSAGES.passwordTooShort);

/**
 * Complete sign-in form validation schema
 */
export const signInSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

/**
 * Inferred type from the sign-in schema
 */
export type SignInSchemaType = z.infer<typeof signInSchema>;

/**
 * Email-only validation (for forgot password)
 */
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordSchemaType = z.infer<typeof forgotPasswordSchema>;
