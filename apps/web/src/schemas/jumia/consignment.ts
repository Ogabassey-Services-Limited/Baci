/**
 * Jumia Vendor Center API — Consignment (Jumia Express) schemas
 */

import { z } from 'zod';

/** Reusable integer count field (non-negative). */
const countField = (label: string) =>
  z
    .int(`${label} must be an integer`)
    .nonnegative(`${label} cannot be negative`);

export const JumiaConsignmentCreateResponseSchema = z.object({
  purchaseOrderNumber: z
    .string()
    .trim()
    .min(1, 'Purchase order number is required'),
});

export const JumiaConsignmentStockResponseSchema = z.object({
  simpleSku: z.string().trim().min(1, 'SKU is required'),
  received: countField('Received count'),
  quarantined: countField('Quarantined count'),
  defective: countField('Defective count'),
  canceled: countField('Canceled count'),
  returned: countField('Returned count'),
  failed: countField('Failed count'),
});

// ── Form schemas ──

/** Build a yyyy-mm-dd string from local date (avoids UTC offset shifting the day). */
export function getLocalYYYYMMDD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function isValidCalendarDate(v: string): boolean {
  const parts = v.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n)))
    return false;
  const [y, m, day] = parts;
  const d = new Date(y, m - 1, day);
  return d.getFullYear() === y && d.getMonth() === m - 1 && d.getDate() === day;
}

export const consignmentProductRowSchema = z.object({
  sku: z.string().trim().min(1, 'SKU is required'),
  quantity: z
    .string()
    .min(1, 'Quantity is required')
    .regex(/^\d+$/, 'Must be a whole number')
    .refine((v) => Number(v) > 0, 'Must be greater than 0'),
  labelCode: z.string(),
});

export const consignmentFormSchema = z.object({
  shippingDate: z
    .string()
    .min(1, 'Shipping date is required.')
    .refine(isValidCalendarDate, {
      error: 'Invalid date.',
    })
    .refine((v) => v >= getLocalYYYYMMDD(), {
      error: 'Shipping date cannot be in the past.',
    }),
  comment: z.string(),
  products: z
    .array(consignmentProductRowSchema)
    .min(1, 'At least one product with SKU and quantity is required.'),
});

export type ConsignmentFormValues = z.infer<typeof consignmentFormSchema>;

// ── Inferred types ──

export type JumiaConsignmentCreateResponse = z.infer<
  typeof JumiaConsignmentCreateResponseSchema
>;
export type JumiaConsignmentStockResponse = z.infer<
  typeof JumiaConsignmentStockResponseSchema
>;
