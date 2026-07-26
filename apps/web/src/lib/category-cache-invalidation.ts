import { logger } from '@/lib/logger';
import { productCacheRevalidation } from '@/lib/product-cache-revalidation';
import { revalidateCategories } from '@/lib/revalidate-categories';

/**
 * Cache invalidation for a category mutation (B1-lite).
 *
 * BOTH SLUGS. A rename invalidates the OLD slug as well as the new one —
 * otherwise the previous category URL keeps serving from cache after the route
 * stops existing. Callers must capture the pre-mutation slug.
 *
 * PRODUCT TAGS TOO. Category-oriented tags are not sufficient: the storefront
 * home products, the paginated product index and the Google/OpenAI feeds all
 * embed joined category names and slugs while carrying product-only tags.
 *
 * NO EDGE PURGE, DELIBERATELY. Calling `cloudflare-purge` here would put
 * `getCloudflareApiToken` — a credential authority — into the static import
 * graph of these API routes, which the event-pipeline boundary gate rejects for
 * any new route. Widening that allowlist is a P0 security-boundary change and
 * does not belong in a category-management PR, so this module imports only lean
 * tag-revalidation helpers and CDN eviction is left to TTL. That is still a
 * strict improvement: before B1-lite the mobile path invalidated nothing but
 * React Query.
 */
export interface CategoryCacheInvalidationResult {
  revalidatedSlugs: string[];
  /** False when tag revalidation threw AFTER the mutation had committed. */
  revalidated: boolean;
}

export function invalidateCategoryCaches(input: {
  merchantId: string;
  /** Slug before the mutation, when it changed or the category was retired. */
  previousSlug?: string | null;
  /** Slug after the mutation, when the category still exists. */
  nextSlug?: string | null;
  /** Child slugs whose hierarchy placement changed in the same transaction. */
  relatedSlugs?: readonly string[];
}): CategoryCacheInvalidationResult {
  const slugs = Array.from(
    new Set(
      [
        input.previousSlug,
        input.nextSlug,
        ...(input.relatedSlugs ?? []),
      ].filter(
        (slug): slug is string => typeof slug === 'string' && slug.length > 0
      )
    )
  );

  // The DB mutation has ALREADY committed by the time we get here, so a
  // throwing cache backend must not surface as a 500. A client retrying a
  // "failed" create would hit a duplicate-slug 409 for a category that exists.
  // Report the failure instead of raising it.
  try {
    if (slugs.length === 0) {
      revalidateCategories(input.merchantId);
    } else {
      for (const slug of slugs) {
        revalidateCategories(input.merchantId, slug);
      }
    }

    // `feedScope: 'merchant'` evicts this merchant's feed entries without
    // churning every other merchant's.
    const productsRevalidated = productCacheRevalidation.revalidateProducts(
      input.merchantId,
      undefined,
      {
        feedScope: 'merchant',
      }
    );
    if (!productsRevalidated) {
      return { revalidatedSlugs: slugs, revalidated: false };
    }
  } catch (error) {
    logger.error({
      message: 'Category revalidation failed AFTER the mutation committed',
      merchantId: input.merchantId,
      slugs,
      error: error instanceof Error ? error.message : String(error),
    });
    return { revalidatedSlugs: slugs, revalidated: false };
  }

  return { revalidatedSlugs: slugs, revalidated: true };
}
