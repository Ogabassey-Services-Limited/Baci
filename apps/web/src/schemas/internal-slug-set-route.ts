import z from 'zod';

/**
 * Path param for `GET /api/internal/slug-set/[identifier]` — the storefront
 * slug or custom domain the proxy resolved.
 */
export const internalSlugSetParamsSchema = z.object({
  identifier: z.string().trim().min(1).max(255),
});

/** Query param: the product slug whose membership is being tested. */
export const internalSlugSetQuerySchema = z.object({
  slug: z.string().trim().min(1).max(255),
});

/** Query params for blog post status resolution. */
export const internalBlogPostStatusQuerySchema = z.object({
  slug: z.string().trim().min(1).max(255),
});

/** Query params for product canonical redirect resolution. */
export const internalProductCanonicalRedirectQuerySchema = z.object({
  category: z.string().trim().min(1).max(255),
  slug: z.string().trim().min(1).max(255),
});
