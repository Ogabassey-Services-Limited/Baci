import { z } from 'zod';
import { normalizeStorefrontConditionValue } from '@/lib/storefront-product-filters';

export const storefrontConditionFilterSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') {
      return value;
    }

    if (value === 'all') {
      return value;
    }

    return normalizeStorefrontConditionValue(value) || value;
  },
  z.enum(['new', 'used', 'open_box', 'all'])
);

export const storefrontProductsQuerySchema = z.object({
  merchant_id: z.string().uuid().optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  condition: storefrontConditionFilterSchema.optional(),
  min_price: z.coerce.number().nonnegative().optional(),
  max_price: z.coerce.number().nonnegative().optional(),
  sort: z.enum(['newest', 'price-asc', 'price-desc']).default('newest'),
  q: z.string().max(100).optional(),
  ids: z.string().optional(),
  has_images: z.coerce.boolean().optional(),
});

export type StorefrontProductsQuery = z.infer<
  typeof storefrontProductsQuerySchema
>;
