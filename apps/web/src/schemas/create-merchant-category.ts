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
 * `merchantId` is OPTIONAL and never authoritative: the route derives the
 * merchant from the session and treats a supplied value only as an assertion to
 * reject on mismatch. Mirrors `/api/cache/revalidate`.
 */
export const createMerchantCategorySchema = z.object({
  merchantId: merchantIdParamSchema.optional(),
  name: requiredCategoryText(MAX_CATEGORY_NAME_LENGTH),
  slug: categorySlugSchema,
  description: sanitizedCategoryText(2000).nullish(),
  imageUrl: categoryImageUrlSchema.nullish(),
  parentId: z.uuid().nullish(),
  displayOrder: z.number().int().min(0).max(100_000).optional(),
  isActive: z.boolean().optional(),
});

export type CreateMerchantCategoryInput = z.infer<
  typeof createMerchantCategorySchema
>;
