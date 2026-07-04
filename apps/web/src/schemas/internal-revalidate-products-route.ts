import z from 'zod';

/**
 * One product whose public storefront URLs should be evicted from Cloudflare
 * alongside the tag revalidation. `slug` OR `id` is required (legacy rows with a
 * null slug stay addressable by id via `/products/<id>`); `category` (legacy
 * text) and `categorySlug` (the resolved category-join slug) are optional hints
 * used to derive the canonical PDP category segment.
 *
 * `slug` and `id` are BOTH `.nullable().optional()` to match the mobile helper's
 * `StorefrontProductRevalidateEntry` contract (`slug?: string | null`, `id?:
 * string | null`): a saved row can carry a null slug (legacy) or a null id, and
 * the caller relies on the slug-or-id fallback. The refinement still rejects an
 * entry with neither, so a null slug requires a present id (and vice versa).
 */
export const internalRevalidateProductEntrySchema = z
  .object({
    slug: z.string().trim().min(1).max(300).nullable().optional(),
    id: z.string().trim().min(1).max(255).nullable().optional(),
    category: z.string().trim().max(300).nullish(),
    categorySlug: z.string().trim().max(300).nullish(),
  })
  .refine((value) => Boolean(value.slug || value.id), {
    message: 'Each product requires a slug or id',
  });

export type InternalRevalidateProductEntry = z.infer<
  typeof internalRevalidateProductEntrySchema
>;

/**
 * Body for `POST /api/internal/revalidate-products` — the merchant whose
 * product caches (incl. the proxy crawl-budget slug-set) should be revalidated.
 *
 * `merchantSlug` + `products` are OPTIONAL and backward compatible: when BOTH
 * are present the route additionally schedules a Cloudflare purge of the listed
 * products' public URLs (the slug identifies the storefront's cache policy).
 * Existing callers that send only `merchantId` keep working unchanged.
 */
export const internalRevalidateProductsBodySchema = z.object({
  merchantId: z.string().trim().min(1).max(255),
  merchantSlug: z.string().trim().min(1).max(255).optional(),
  products: z.array(internalRevalidateProductEntrySchema).max(1000).optional(),
});
