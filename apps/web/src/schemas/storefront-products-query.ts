import { z } from 'zod';
import { storefrontConditionFilterSchema } from '@/schemas/storefront-condition-filter';

const storefrontBooleanQuerySchema = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim().toLowerCase();

  if (['true', '1', 'yes'].includes(normalized)) {
    return true;
  }

  if (['false', '0', 'no'].includes(normalized)) {
    return false;
  }

  return value;
}, z.boolean());

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
  has_images: storefrontBooleanQuerySchema.optional(),
});
