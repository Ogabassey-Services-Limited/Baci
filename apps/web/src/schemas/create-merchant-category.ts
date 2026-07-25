import { z } from 'zod';
import { categorySlugSchema } from './category-slug';

/**
 * `merchantId` is OPTIONAL and never authoritative: the route derives the
 * merchant from the session and treats a supplied value only as an assertion to
 * reject on mismatch. Mirrors `/api/cache/revalidate`.
 */
const merchantIdAssertion = z.string().trim().min(1).max(255).optional();

export const createMerchantCategorySchema = z.object({
  merchantId: merchantIdAssertion,
  name: z.string().trim().min(1).max(160),
  slug: categorySlugSchema,
  description: z.string().trim().max(2000).nullish(),
  imageUrl: z.string().trim().url().max(2048).nullish(),
  parentId: z.uuid().nullish(),
  displayOrder: z.number().int().min(0).max(100_000).optional(),
  isActive: z.boolean().optional(),
});

export type CreateMerchantCategoryInput = z.infer<
  typeof createMerchantCategorySchema
>;
