import { z } from 'zod';
import { categoryImageUrlSchema } from './category-image-url';
import { categorySlugSchema } from './category-slug';
import {
  requiredCategoryText,
  sanitizedCategoryText,
} from './sanitized-category-text';

const merchantIdAssertion = z.string().trim().min(1).max(255).optional();

/**
 * Every field optional, but at least one must be present — an empty PATCH would
 * purge caches for no reason.
 */
export const updateMerchantCategorySchema = z
  .object({
    merchantId: merchantIdAssertion,
    name: requiredCategoryText(160).optional(),
    slug: categorySlugSchema.optional(),
    description: sanitizedCategoryText(2000).nullish(),
    imageUrl: categoryImageUrlSchema.nullish(),
    parentId: z.uuid().nullish(),
    displayOrder: z.number().int().min(0).max(100_000).optional(),
    // `false` is the "deactivate" operation — a soft disable, so the public read
    // policy (is_active = true) hides it without orphaning products.
    isActive: z.boolean().optional(),
  })
  .refine(
    (value) =>
      Object.keys(value).some(
        (key) =>
          key !== 'merchantId' && value[key as keyof typeof value] !== undefined
      ),
    { message: 'At least one field must be provided' }
  );

export type UpdateMerchantCategoryInput = z.infer<
  typeof updateMerchantCategorySchema
>;
