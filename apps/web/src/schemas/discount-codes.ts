import { z } from 'zod';

const discountCodeBaseFields = z.object({
  code: z.string().trim().min(1).max(50).toUpperCase(),
  description: z.string().max(500).nullable().optional(),
  discount_type: z.enum(['percentage', 'fixed_amount']),
  discount_value: z.number().positive(),
  minimum_purchase_amount: z.number().nonnegative().optional().default(0),
  maximum_discount_amount: z.number().positive().nullable().optional(),
  usage_limit: z.int().positive().nullable().optional(),
  usage_limit_per_customer: z.int().positive().optional().default(1),
  starts_at: z.iso.datetime().nullable().optional(),
  expires_at: z.iso.datetime().nullable().optional(),
  is_active: z.boolean().optional().default(true),
  applies_to: z
    .enum(['all', 'specific_products', 'specific_categories'])
    .optional()
    .default('all'),
  product_ids: z.array(z.uuid()).optional().default([]),
  category_ids: z.array(z.uuid()).optional().default([]),
});

const appliesToRefinement = (
  data: z.infer<typeof discountCodeBaseFields>
): boolean => {
  if (data.applies_to === 'specific_products') {
    return data.product_ids !== undefined && data.product_ids.length > 0;
  }
  if (data.applies_to === 'specific_categories') {
    return data.category_ids !== undefined && data.category_ids.length > 0;
  }
  return true;
};

export const createDiscountCodeSchema = discountCodeBaseFields.refine(
  appliesToRefinement,
  {
    path: ['applies_to'],
    error:
      'product_ids or category_ids must be provided when applies_to targets them',
  }
);

export const updateDiscountCodeSchema = discountCodeBaseFields.partial().refine(
  (data) => {
    // Only validate applies_to relationship when applies_to is explicitly provided
    if (data.applies_to === 'specific_products') {
      return data.product_ids !== undefined && data.product_ids.length > 0;
    }
    if (data.applies_to === 'specific_categories') {
      return data.category_ids !== undefined && data.category_ids.length > 0;
    }
    return true;
  },
  {
    path: ['applies_to'],
    error:
      'product_ids or category_ids must be provided when applies_to targets them',
  }
);

export const validateDiscountCodeSchema = z.object({
  code: z.string().trim().min(1),
  merchantId: z.uuid(),
  customerEmail: z.email().optional(),
  orderTotal: z.number().nonnegative(),
  productIds: z.array(z.uuid()).optional().default([]),
  categoryIds: z.array(z.uuid()).optional().default([]),
});
