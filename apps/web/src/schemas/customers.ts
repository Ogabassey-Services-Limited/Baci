import { z } from 'zod';
import { formatPersonName } from '@/lib/format-person-name';
import {
  sanitizeEmail,
  sanitizePhone,
  sanitizeText,
} from '@/lib/sanitize-core';

const customerStoreCreditSchema = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.coerce.number().min(0).max(1_000_000_000).optional()
);

function requireCompanyNameWhenCompany(
  data: {
    company_name?: string | null;
    customer_type?: 'individual' | 'company' | null;
  },
  ctx: z.RefinementCtx
) {
  if (data.customer_type === 'company' && !data.company_name?.trim()) {
    ctx.addIssue({
      code: 'custom',
      message: 'Company name is required',
      path: ['company_name'],
    });
  }
}

export const createCustomerSchema = z
  .object({
    customer_type: z.enum(['individual', 'company']).optional().nullable(),
    company_name: z
      .string()
      .transform((val) => sanitizeText(val, 200))
      .optional()
      .nullable(),
    first_name: z
      .string()
      .transform((val) => formatPersonName(sanitizeText(val, 100)))
      .optional()
      .nullable(),
    last_name: z
      .string()
      .transform((val) => formatPersonName(sanitizeText(val, 100)))
      .optional()
      .nullable(),
    email: z
      .string()
      .transform((val) => sanitizeEmail(val))
      .pipe(z.union([z.literal(''), z.email()]))
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
    store_credit: customerStoreCreditSchema.optional().nullable(),
    notes: z
      .string()
      .transform((val) => sanitizeText(val, 1000))
      .optional()
      .nullable(),
  })
  .superRefine(requireCompanyNameWhenCompany);

export const updateCustomerSchema = z
  .object({
    customer_type: z.enum(['individual', 'company']).optional().nullable(),
    company_name: z
      .string()
      .transform((val) => sanitizeText(val, 200))
      .optional()
      .nullable(),
    first_name: z
      .string()
      .transform((val) => formatPersonName(sanitizeText(val, 100)))
      .optional()
      .nullable(),
    last_name: z
      .string()
      .transform((val) => formatPersonName(sanitizeText(val, 100)))
      .optional()
      .nullable(),
    full_name: z
      .string()
      .transform((val) => formatPersonName(sanitizeText(val, 100)))
      .optional()
      .nullable(),
    email: z
      .string()
      .transform((val) => sanitizeEmail(val))
      .pipe(z.union([z.literal(''), z.email()]))
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
    store_credit: customerStoreCreditSchema.optional().nullable(),
  })
  .superRefine(requireCompanyNameWhenCompany);

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
