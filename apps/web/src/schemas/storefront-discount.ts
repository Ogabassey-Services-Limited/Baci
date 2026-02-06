import { z } from 'zod';

export const storefrontDiscountValidateSchema = z.object({
  merchant_id: z.string().uuid(),
  code: z.string().min(1),
  cart_total: z.number().nonnegative(),
});

export type StorefrontDiscountValidateInput = z.infer<
  typeof storefrontDiscountValidateSchema
>;

export interface StorefrontDiscountCodeRow {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  starts_at: string | null;
  expires_at: string | null;
  usage_limit: number | null;
  usage_count: number;
  minimum_purchase_amount: number | null;
  maximum_discount_amount: number | null;
  description: string | null;
}
