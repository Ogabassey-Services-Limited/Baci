/**
 * On-Demand Cache Revalidation Utilities
 *
 * Provides helper functions to invalidate cached data when mutations occur.
 * Uses Next.js 16 revalidateTag() to bust 'use cache' entries.
 *
 * The second argument to revalidateTag() is the cacheLife profile name —
 * it tells Next.js to serve stale data during background revalidation
 * using the timing from that profile.
 *
 * Usage: Call the appropriate function after a successful DB mutation in API routes.
 */
import { revalidatePath, revalidateTag } from 'next/cache';
import { after } from 'next/server';
import { getBlogCacheTag } from '@/lib/blog-cache-tags';
import { purgeCloudflareUrls } from '@/lib/cloudflare-purge';
import {
  getPlatformBlogPostCacheTag,
  PLATFORM_BLOG_CACHE_TAG,
  PLATFORM_BLOG_FEED_CACHE_TAG,
  PLATFORM_BLOG_LIST_CACHE_TAG,
  PLATFORM_BLOG_SITEMAP_CACHE_TAG,
} from '@/lib/platform-blog';
import {
  getProductScopedCacheTag,
  getProductSlugSetCacheTag,
} from '@/lib/product-cache-tags';
import { generateSlug } from '@/lib/seo-utils';
import { buildStorefrontProductsCacheTags } from '@/lib/storefront-products-cache-key';
import { buildStorefrontBlogPurgeUrls } from '@/lib/storefront-purge-urls';

interface BlogRevalidationOptions {
  identifiers?: Array<string | null | undefined>;
  canonicalMerchantSlug?: string | null | undefined;
  listingCategories?: Array<string | null | undefined>;
  listingPages?: Array<number | null | undefined>;
  postSlugs?: Array<string | null | undefined>;
}

const CANONICAL_MERCHANT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isSafeCanonicalMerchantSlug(slug: string): boolean {
  return CANONICAL_MERCHANT_SLUG_PATTERN.test(slug);
}

function normalizeMerchantIdForRevalidation(merchantId: string) {
  if (typeof merchantId !== 'string') {
    return null;
  }

  const normalizedMerchantId = merchantId.trim();
  return normalizedMerchantId || null;
}

/**
 * Evict the given canonical URLs from Cloudflare's edge cache. Fire-and-forget:
 * uses `after()` when a request context exists (so the purge runs even after the
 * response is flushed) and falls back to a detached promise in cron/worker
 * contexts. `purgeCloudflareUrls` never throws, so this never affects the caller.
 */
function schedulePurgeCloudflareUrls(urls: string[]): void {
  if (urls.length === 0) {
    return;
  }

  try {
    after(() => purgeCloudflareUrls(urls));
  } catch {
    // Not inside a request scope (standalone worker / test) — detach instead.
    void purgeCloudflareUrls(urls);
  }
}

/**
 * Revalidate all cached data related to a merchant's products.
 * Call after product create/update/delete.
 */
export function revalidateProducts(merchantId: string, productSlug?: string) {
  const normalizedMerchantId = normalizeMerchantIdForRevalidation(merchantId);

  if (!normalizedMerchantId) {
    console.warn('Skipped product cache revalidation for invalid merchant ID', {
      merchantId,
    });
    return;
  }

  // Invalidate the product list for this merchant
  revalidateTag(`products-${normalizedMerchantId}`, 'products');
  for (const tag of buildStorefrontProductsCacheTags(normalizedMerchantId)) {
    revalidateTag(tag, 'products');
  }

  // Invalidate specific product cache if slug provided
  if (productSlug) {
    revalidateTag(
      getProductScopedCacheTag('product', normalizedMerchantId, productSlug),
      'products'
    );
  }

  // Invalidate product details and category page data (includes products)
  revalidateTag('product-details', 'products');
  revalidateTag('category-page-data', 'storefront-page');

  // Invalidate storefront product index (paginated listing)
  revalidateTag(`product-index-${normalizedMerchantId}`, 'products');

  // Invalidate the proxy crawl-budget slug-set (PR-B §3.3 invalidation contract):
  // a published/unpublished/archived/deleted/slug-changed product must enter or
  // leave the set so the proxy never hard-404s a live product or serves a stale
  // 200 for a removed one. Every product mutation path funnels through here.
  revalidateTag(getProductSlugSetCacheTag(normalizedMerchantId), 'products');

  // Invalidate product redirect caches
  revalidateTag('product-canonical-redirect', 'products');
  revalidateTag('product-legacy-redirect', 'products');

  // Invalidate merchant feed (OpenAI, Google Merchant)
  revalidateMerchantFeed(normalizedMerchantId);

  // Dashboard stats may change (revenue, inventory counts)
  revalidateTag(`dashboard-${normalizedMerchantId}`, 'merchant');
}

/**
 * Invalidate ONLY the per-slug scoped product-detail Next cache tags for the
 * given slugs. `getCachedProduct`, `getCachedProductWithDetails`, and
 * `getCachedProductLcpHint` each tag their entry with
 * `getProductScopedCacheTag('product', merchantId, slug)`. `revalidateProducts`
 * (called with no slug) busts the merchant-WIDE product tags but leaves each
 * product's per-slug entry cached until its cacheLife TTL — so a Cloudflare MISS
 * after an edge purge would REFILL the edge from stale Next-cached product data,
 * defeating the purge. Product-purge callers invoke this for every RESOLVED slug
 * BEFORE scheduling the edge purge to close that gap.
 *
 * Blank/duplicate slugs are skipped. Safe to over-supply (authoritative slug +
 * caller slug + id): a tag with no cached entry revalidates to a no-op.
 */
export function revalidateProductSlugs(
  merchantId: string,
  slugs: readonly (string | null | undefined)[]
): void {
  const normalizedMerchantId = normalizeMerchantIdForRevalidation(merchantId);
  if (!normalizedMerchantId) {
    return;
  }

  const seen = new Set<string>();
  for (const rawSlug of slugs) {
    const slug = rawSlug?.trim();
    if (!slug || seen.has(slug)) {
      continue;
    }
    seen.add(slug);
    revalidateTag(
      getProductScopedCacheTag('product', normalizedMerchantId, slug),
      'products'
    );
  }
}

/**
 * Revalidate all cached data related to a merchant's categories.
 * Call after category create/update/delete.
 */
export function revalidateCategories(
  merchantId: string,
  categorySlug?: string
) {
  revalidateTag(`categories-${merchantId}`, 'categories');
  revalidateTag('navigation-categories', 'categories');
  revalidateTag('category-page-data', 'storefront-page');
  revalidateTag('product-canonical-redirect', 'products');
  revalidateTag('product-legacy-redirect', 'products');

  if (categorySlug) {
    revalidateTag(`category-${merchantId}-${categorySlug}`, 'categories');
  }
}

/**
 * Revalidate all cached data related to a merchant store.
 * Call after merchant settings update, publish/unpublish, etc.
 */
export function revalidateMerchant(merchantId: string, merchantSlug?: string) {
  revalidateTag('merchants', 'merchant');
  revalidateTag(`merchant-id-${merchantId}`, 'merchant');

  if (merchantSlug) {
    revalidateTag(`merchant-${merchantSlug}`, 'merchant');
  }

  // Dashboard stats may change
  revalidateTag(`dashboard-${merchantId}`, 'merchant');
}

/**
 * Bust EVERY per-slug merchant cache for a specific slug:
 *   - `merchant-slug-${slug}` + 'merchant' — the /api/merchants/by-slug route
 *   - `merchant-${slug}` + 'merchants' — getCachedMerchant() in lib/cached-data.ts
 * None of these are cleared by revalidateMerchant() for a slug OTHER than the one
 * passed to it. Call this for BOTH the old and the new slug after a rename so the
 * retired slug stops resolving to a live store and the new slug serves at once,
 * instead of staying cached for up to 5 minutes.
 */
export function revalidateMerchantSlugLookup(slug: string) {
  revalidateTag('merchant', 'merchant');
  revalidateTag(`merchant-slug-${slug}`, 'merchant');
  revalidateTag(`merchant-${slug}`, 'merchant');
}

/**
 * Bust the `/api/storefront/[slug]/products` merchant-id lookup cache. That route's
 * `getMerchantIdBySlug` caches results (a MISS included) under the generic
 * 'merchant-slug' tag for 60s, and the tag is not per-slug, so
 * `revalidateMerchantSlugLookup` (which targets `merchant-slug-${slug}`) can't
 * clear it. After a rename, a pre-rename probe of the NEW slug would otherwise
 * 404 the renamed store's products API until the cached miss expires. Call once
 * per rename (the tag is shared across all slugs).
 */
export function revalidateStorefrontProductsSlugCache() {
  revalidateTag('merchant-slug', 'merchant');
}

/**
 * Bust the blog RSS feed cache (`/api/blog/feed/[merchantSlug]`). It caches the
 * merchant + posts payload by merchant id under the generic 'blog-rss-feed' /
 * 'blog-posts' tags for an hour and EMBEDS the slug in the feed's storeUrl/feedUrl.
 * After a rename, both the old-alias URL and the new-slug URL resolve to the same
 * cached object and keep emitting the retired slug until the TTL — so bust it on
 * rename. Tags are not per-merchant, so call once.
 */
export function revalidateBlogFeed() {
  revalidateTag('blog-rss-feed', 'merchant');
  revalidateTag('blog-posts', 'merchant');
}

/**
 * Revalidate blog post cache.
 * Call after blog post create/update/delete/publish.
 */
export function revalidateBlogPosts(
  identifierOrOptions: string | BlogRevalidationOptions,
  postSlug?: string
) {
  const identifiers =
    typeof identifierOrOptions === 'string'
      ? [identifierOrOptions]
      : (identifierOrOptions.identifiers ?? []);
  const postSlugs =
    typeof identifierOrOptions === 'string'
      ? [postSlug]
      : (identifierOrOptions.postSlugs ?? []);
  const listingCategories =
    typeof identifierOrOptions === 'string'
      ? []
      : (identifierOrOptions.listingCategories ?? []);
  const listingPages =
    typeof identifierOrOptions === 'string'
      ? []
      : (identifierOrOptions.listingPages ?? []);
  const canonicalMerchantSlug =
    typeof identifierOrOptions === 'string'
      ? null
      : (identifierOrOptions.canonicalMerchantSlug ?? null);

  const normalizedIdentifiers = Array.from(
    new Set(
      identifiers
        .map((identifier) => identifier?.trim().toLowerCase())
        .filter((identifier): identifier is string => Boolean(identifier))
    )
  );
  const normalizedPostSlugs = Array.from(
    new Set(
      postSlugs
        .map((slug) => slug?.trim().toLowerCase())
        .filter((slug): slug is string => Boolean(slug))
    )
  );
  const normalizedListingCategories = Array.from(
    new Set([
      'all',
      ...listingCategories
        .map((category) => category?.trim())
        .filter((category): category is string => Boolean(category)),
    ])
  );
  const normalizedListingPages = Array.from(
    new Set(
      listingPages.filter(
        (page): page is number =>
          typeof page === 'number' && Number.isInteger(page) && page > 0
      )
    )
  );
  const effectiveListingPages =
    normalizedListingPages.length > 0 ? normalizedListingPages : [1];
  const rawCanonicalMerchantSlug =
    canonicalMerchantSlug?.trim().toLowerCase() || '';
  const normalizedCanonicalMerchantSlug = isSafeCanonicalMerchantSlug(
    rawCanonicalMerchantSlug
  )
    ? rawCanonicalMerchantSlug
    : '';

  if (normalizedIdentifiers.length > 0 || rawCanonicalMerchantSlug.length > 0) {
    // RSS cache entries use coarse shared tags by design. The merchant-scoped
    // feed path below narrows the route cache refresh for the canonical slug.
    revalidateTag('blog-rss-feed', 'merchant');
    revalidateTag('blog-posts', 'merchant');
  }

  if (
    rawCanonicalMerchantSlug.length > 0 &&
    normalizedCanonicalMerchantSlug.length === 0
  ) {
    console.warn('Skipped blog feed path revalidation for invalid slug', {
      canonicalMerchantSlug: rawCanonicalMerchantSlug,
    });
  }

  if (normalizedCanonicalMerchantSlug.length > 0) {
    revalidatePath(`/api/blog/feed/${normalizedCanonicalMerchantSlug}`);
  }

  for (const identifier of normalizedIdentifiers) {
    revalidatePath(`/${identifier}/blog`);

    for (const category of normalizedListingCategories) {
      for (const page of effectiveListingPages) {
        revalidateTag(
          `blog-list-${identifier}-${category}-${page}`,
          'merchant'
        );
      }
    }

    for (const slug of normalizedPostSlugs) {
      revalidateTag(getBlogCacheTag(identifier, slug), 'merchant');
      revalidatePath(`/${identifier}/blog/${slug}`);
      revalidatePath(`/${identifier}/blog/${slug}/opengraph-image`);
    }
  }

  // Evict the Cloudflare-fronted public blog URLs so the raised edge TTL never
  // serves a stale post/listing. No-op for storefronts without a cache policy.
  const purgeIdentifiers = Array.from(
    new Set(
      [...normalizedIdentifiers, normalizedCanonicalMerchantSlug].filter(
        (identifier): identifier is string => identifier.length > 0
      )
    )
  );
  // Derive the category listing slugs to evict from the affected category
  // labels. The public category route is /blog/category/<slug> where the slug
  // is generateSlug(label) (getBlogCategorySlug), so slugify here to match the
  // actually-cached URL. The 'all' sentinel used for the blog-list cache tags
  // is intentionally excluded: its listing is /blog, already purged above.
  const purgeCategorySlugs = Array.from(
    new Set(
      listingCategories
        .map((category) => (category ? generateSlug(category) : ''))
        .filter((categorySlug): categorySlug is string => Boolean(categorySlug))
    )
  );
  // `buildStorefrontBlogPurgeUrls` runs OUTSIDE the never-throw purge helper, so
  // guard the build + schedule sequence: a Cloudflare purge is always survivable
  // (caches self-heal on their TTL), and it must never break the Next-tag/path
  // revalidation that already ran above.
  try {
    schedulePurgeCloudflareUrls(
      buildStorefrontBlogPurgeUrls(
        purgeIdentifiers,
        normalizedPostSlugs,
        purgeCategorySlugs
      )
    );
  } catch (error) {
    console.warn('Skipped Cloudflare blog purge scheduling', { error });
  }
}

export function revalidatePlatformBlog(slug?: string) {
  revalidateTag(PLATFORM_BLOG_CACHE_TAG, 'merchant');
  revalidateTag(PLATFORM_BLOG_LIST_CACHE_TAG, 'merchant');
  revalidateTag(PLATFORM_BLOG_SITEMAP_CACHE_TAG, 'merchant');
  revalidateTag(PLATFORM_BLOG_FEED_CACHE_TAG, 'merchant');

  const normalizedSlug = slug?.trim().toLowerCase();
  if (normalizedSlug) {
    revalidateTag(getPlatformBlogPostCacheTag(normalizedSlug), 'merchant');
    revalidatePath(`/blog/${normalizedSlug}`);
    revalidatePath(`/blog/${normalizedSlug}/opengraph-image`);
  }

  revalidatePath('/blog');
  revalidatePath('/blog/feed.xml');
  revalidatePath('/sitemap.xml');
}

/**
 * Revalidate product review cache.
 * Call after review create/update/approve/delete.
 */
export function revalidateReviews(productId: string) {
  revalidateTag(`reviews-${productId}`, 'products');
  revalidateTag(`rating-stats-${productId}`, 'products');
}

/**
 * Revalidate merchant feature settings cache.
 * Call after feature toggle changes.
 */
export function revalidateFeatures(merchantId: string) {
  revalidateTag(`features-${merchantId}`, 'merchant');
}

/**
 * Revalidate page builder config cache.
 * Call after page config publish.
 */
export function revalidatePageConfig(merchantId: string, pageSlug?: string) {
  revalidateTag('page-config', 'storefront-page');

  if (pageSlug) {
    revalidateTag(`page-config-${merchantId}-${pageSlug}`, 'storefront-page');
  }
}

/**
 * Revalidate the feed cache (Google Merchant + OpenAI) for a merchant.
 * Call after the backfill script populates/refreshes `product_feed_images`,
 * or after any mutation that changes feed-relevant product data.
 *
 * @param merchantId - Canonical merchant UUID (not slug).
 */
export function revalidateMerchantFeed(merchantId: string) {
  revalidateTag('google-merchant-feed', 'products');
  revalidateTag(`merchant-feed-${merchantId}`, 'products');
  revalidateTag(`merchant-feed-review-signals-${merchantId}`, 'products');
}

/**
 * Revalidate domain-related caches.
 * Call after custom domain add/remove/verify.
 */
export function revalidateDomains(domain?: string) {
  revalidateTag('domains', 'merchant');

  if (domain) {
    revalidateTag(`domain-${domain.toLowerCase()}`, 'merchant');
  }
}

/**
 * Revalidate cached platform analytics data.
 * Call after platform-level analytics views are refreshed.
 */
export function revalidateAnalytics() {
  revalidateTag('analytics', 'products');
}
