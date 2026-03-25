/**
 * Jumia Vendor Center API — Consignment (Jumia Express) schemas
 */

import { z } from 'zod';

/** Reusable integer count field (non-negative). */
const countField = (label: string) =>
  z
    .number()
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

// ── Inferred types ──

export type JumiaConsignmentCreateResponse = z.infer<
  typeof JumiaConsignmentCreateResponseSchema
>;
export type JumiaConsignmentStockResponse = z.infer<
  typeof JumiaConsignmentStockResponseSchema
>;
