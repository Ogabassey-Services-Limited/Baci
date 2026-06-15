import z from 'zod';

/**
 * Body for `POST /api/internal/revalidate-products` — the merchant whose
 * product caches (incl. the proxy crawl-budget slug-set) should be revalidated.
 */
export const internalRevalidateProductsBodySchema = z.object({
  merchantId: z.string().trim().min(1).max(255),
});
