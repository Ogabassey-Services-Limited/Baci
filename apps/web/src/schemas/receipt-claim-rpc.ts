import { z } from 'zod';

const receiptClaimOrderItemSchema = z.object({
  name: z.string().nullable(),
  quantity: z.number().nullable(),
});

const receiptClaimOrderSchema = z.object({
  id: z.string(),
  order_items: z.array(receiptClaimOrderItemSchema).nullable().optional(),
  order_number: z.string(),
});

const receiptClaimMerchantSchema = z.object({
  business_name: z.string().nullable(),
  slug: z.string().nullable(),
});

export const receiptClaimRecordSchema = z.object({
  claimed_at: z.string().nullable(),
  claimed_by_user_id: z.string().nullable(),
  customer_email: z.string(),
  customer_id: z.string(),
  customer_name: z.string().nullable(),
  expires_at: z.string(),
  id: z.string(),
  merchant_id: z.string(),
  merchant: receiptClaimMerchantSchema.nullable().optional(),
  orders: z.array(receiptClaimOrderSchema).nullable().optional(),
});

export const redeemReceiptClaimResultSchema = z.object({
  redirectPath: z
    .string()
    .regex(/^\/(?!\/)/, 'Invalid redirect path')
    .optional(),
  status: z.enum([
    'already_used',
    'customer_link_failed',
    'email_mismatch',
    'expired',
    'not_found',
    'ok',
    'unauthorized',
  ]),
});

export const createReceiptClaimResultSchema = z.object({
  claim_id: z.string().nullable().optional(),
  status: z.enum(['created', 'skipped']),
});

export type ReceiptClaimRecord = z.infer<typeof receiptClaimRecordSchema>;
export type CreateReceiptClaimResult = z.infer<
  typeof createReceiptClaimResultSchema
>;
export type RedeemReceiptClaimResult = z.infer<
  typeof redeemReceiptClaimResultSchema
>;
