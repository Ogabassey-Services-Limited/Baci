import { z } from 'zod';
import {
  sanitizeEmail,
  sanitizePhone,
  sanitizeText,
} from '@/lib/sanitize-core';

export const createCustomerSchema = z.object({
  first_name: z
    .string()
    .transform((val) => sanitizeText(val, 100))
    .optional()
    .nullable(),
  last_name: z
    .string()
    .transform((val) => sanitizeText(val, 100))
    .optional()
    .nullable(),
  email: z
    .string()
    .transform((val) => sanitizeEmail(val))
    .pipe(z.union([z.literal(''), z.string().email()]))
    .optional()
    .nullable(),
  phone: z
    .string()
    .transform((val) => sanitizePhone(val))
    .optional()
    .nullable(),
  address: z
    .string()
    .transform((val) => sanitizeText(val, 500))
    .optional()
    .nullable(),
  city: z
    .string()
    .transform((val) => sanitizeText(val, 100))
    .optional()
    .nullable(),
  state: z
    .string()
    .transform((val) => sanitizeText(val, 100))
    .optional()
    .nullable(),
  notes: z
    .string()
    .transform((val) => sanitizeText(val, 1000))
    .optional()
    .nullable(),
});

/**
 * Helper to format Zod errors for API responses
 */
export function formatZodErrors(error: z.ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_root';
    if (!errors[path]) {
      errors[path] = [];
    }
    errors[path].push(issue.message);
  }

  return errors;
}
