import { MAX_CATEGORY_NAME_LENGTH } from '@baci/shared';
import { z } from 'zod';
import { categoryImageUrlSchema } from './category-image-url';
import { categorySlugSchema } from './category-slug';
import { merchantIdParamSchema } from './merchant-id-param';
import {
  requiredCategoryText,
  sanitizedCategoryText,
} from './sanitized-category-text';

/**
 * Every field optional, but at least one must be present — an empty PATCH would
 * purge caches for no reason.
 */
export const updateMerchantCategorySchema = z
  .object({
    merchantId: merchantIdParamSchema.optional(),
    name: requiredCategoryText(MAX_CATEGORY_NAME_LENGTH).optional(),
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
