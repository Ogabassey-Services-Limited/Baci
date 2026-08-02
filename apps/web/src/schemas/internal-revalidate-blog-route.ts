import { z } from 'zod';

const safeIdentifierSchema = z.string().trim().min(1).max(255);
const safeSlugSchema = z.string().trim().min(1).max(255);

/**
 * Body for `POST /api/internal/revalidate-blog`.
 *
 * Standalone VPS content jobs mutate blog rows outside a Next request context,
 * so they cannot call `revalidatePath`/`revalidateTag` directly. This payload
 * gives the app route the exact storefront identifiers and blog slugs to evict.
 */
export const internalRevalidateBlogBodySchema = z.strictObject({
  identifiers: z.array(safeIdentifierSchema).min(1).max(20),
  merchantId: z.string().trim().uuid().optional(),
  canonicalMerchantSlug: safeIdentifierSchema.optional(),
  listingCategories: z.array(safeSlugSchema).max(50).optional(),
  listingPages: z.array(z.number().int().positive()).max(50).optional(),
  postSlugs: z.array(safeSlugSchema).min(1).max(250),
});
