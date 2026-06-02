import { z } from 'zod';

export const storefrontDiscountValidateSchema = z.object({
  merchant_id: z.uuid(),
  code: z.string().trim().min(1),
  cart_total: z.number().nonnegative(),
});

export type StorefrontDiscountValidateInput = z.infer<
  typeof storefrontDiscountValidateSchema
>;

export const storefrontDiscountCodeRowSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  discount_type: z.enum(['percentage', 'fixed_amount']),
  discount_value: z.coerce.number(),
  starts_at: z.string().nullable(),
  expires_at: z.string().nullable(),
  usage_limit: z.coerce.number().nullable(),
  usage_count: z.coerce.number(),
  minimum_purchase_amount: z.coerce.number().nullable(),
  maximum_discount_amount: z.coerce.number().nullable(),
  description: z.string().nullable(),
});

export type StorefrontDiscountCodeRow = z.infer<
  typeof storefrontDiscountCodeRowSchema
>;
