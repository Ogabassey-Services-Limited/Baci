import type { SupabaseClient } from '@supabase/supabase-js';
import { getStorefrontPublicationCacheIdentity } from '@/lib/get-storefront-publication-cache-identity';
import { logger } from '@/lib/logger';
import { productCacheRevalidation } from '@/lib/product-cache-revalidation';
import { revalidateCategories } from '@/lib/revalidate-categories';
import { buildStorefrontPublicationCacheTags } from '@/lib/storefront-publication-cache-tags';
import { purgeVercelStorefrontPublicationCache } from '@/lib/vercel-storefront-publication-cache';

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
 * VERCEL EDGE EVICTION, WITHOUT CLOUDFLARE CREDENTIALS. The active category
 * HTML layer is Vercel and already carries tenant publication tags. Hard-expire
 * the inner Next data first, then delete those response tags through Vercel's
 * supported runtime primitive. Do not import `cloudflare-purge`: it reaches
 * `getCloudflareApiToken`, which is credential authority forbidden to these new
 * merchant routes by the event-pipeline boundary gate.
 * These category routes do not schedule a Cloudflare purge because they do not
 * hold credential authority. The five-minute edge TTL bounds any remaining
 * stale Cloudflare response after the Next and Vercel invalidations complete.
 */
export interface CategoryCacheInvalidationResult {
  revalidatedSlugs: string[];
  /** False when tag revalidation threw AFTER the mutation had committed. */
  revalidated: boolean;
  /** False when the active Vercel HTML layer could not be evicted. */
  vercelEvicted: boolean;
}

function reportVercelEvictionFailure(
  merchantId: string,
  slugs: string[],
  detail: { error: string } | { reason: string }
): CategoryCacheInvalidationResult {
  logger.error({
    message:
      'Category Vercel cache eviction failed AFTER the mutation committed',
    merchantId,
    ...detail,
  });
  return {
    revalidatedSlugs: slugs,
    revalidated: true,
    vercelEvicted: false,
  };
}

export async function invalidateCategoryCaches(input: {
  canonicalMerchantSlug: string | null;
  merchantId: string;
  supabase: SupabaseClient;
  /** Slug before the mutation, when it changed or the category was retired. */
  previousSlug?: string | null;
  /** Slug after the mutation, when the category still exists. */
  nextSlug?: string | null;
  /** Child slugs whose hierarchy placement changed in the same transaction. */
  relatedSlugs?: readonly string[];
}): Promise<CategoryCacheInvalidationResult> {
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
      revalidateCategories(input.merchantId, undefined, {
        expireImmediately: true,
      });
    } else {
      for (const slug of slugs) {
        revalidateCategories(input.merchantId, slug, {
          expireImmediately: true,
        });
      }
    }

    // `feedScope: 'merchant'` evicts this merchant's feed entries without
    // churning every other merchant's.
    const productsRevalidated = productCacheRevalidation.revalidateProducts(
      input.merchantId,
      undefined,
      {
        expireImmediately: true,
        feedScope: 'merchant',
      }
    );
    if (!productsRevalidated) {
      logger.error({
        message:
          'Product cache revalidation failed AFTER the mutation committed',
        merchantId: input.merchantId,
        slugs,
      });
      return {
        revalidatedSlugs: slugs,
        revalidated: false,
        vercelEvicted: false,
      };
    }
  } catch (error) {
    logger.error({
      message: 'Category revalidation failed AFTER the mutation committed',
      merchantId: input.merchantId,
      slugs,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      revalidatedSlugs: slugs,
      revalidated: false,
      vercelEvicted: false,
    };
  }

  try {
    const identity = await getStorefrontPublicationCacheIdentity(
      input.supabase,
      input.merchantId,
      input.canonicalMerchantSlug
    );
    const tags = buildStorefrontPublicationCacheTags({
      customDomains: identity.customDomains,
      merchantSlugs: identity.merchantSlugs,
    });
    const result = await purgeVercelStorefrontPublicationCache(tags);
    if (!result.ok) {
      return reportVercelEvictionFailure(input.merchantId, slugs, {
        reason: result.reason,
      });
    }
  } catch (error) {
    return reportVercelEvictionFailure(input.merchantId, slugs, {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return {
    revalidatedSlugs: slugs,
    revalidated: true,
    vercelEvicted: true,
  };
}
