import { z } from 'zod';

export const createDiscountCodeSchema = z.object({
  code: z.string().trim().min(1).toUpperCase(),
  description: z.string().nullable().optional(),
  discount_type: z.enum(['percentage', 'fixed_amount']),
  discount_value: z.number().positive(),
  minimum_purchase_amount: z.number().nonnegative().optional().default(0),
  maximum_discount_amount: z.number().positive().nullable().optional(),
  usage_limit: z.number().positive().nullable().optional(),
  usage_limit_per_customer: z.number().positive().optional().default(1),
  starts_at: z.string().datetime().nullable().optional(),
  expires_at: z.string().datetime().nullable().optional(),
  is_active: z.boolean().optional().default(true),
  applies_to: z
    .enum(['all', 'specific_products', 'specific_categories'])
    .optional()
    .default('all'),
  product_ids: z.array(z.string().uuid()).optional().default([]),
  category_ids: z.array(z.string().uuid()).optional().default([]),
});

export const updateDiscountCodeSchema = createDiscountCodeSchema.partial();

export const validateDiscountCodeSchema = z.object({
  code: z.string().trim().min(1),
  merchantId: z.string().uuid(),
  customerEmail: z.string().email().optional(),
  orderTotal: z.number().nonnegative(),
  productIds: z.array(z.string().uuid()).optional().default([]),
  categoryIds: z.array(z.string().uuid()).optional().default([]),
});
