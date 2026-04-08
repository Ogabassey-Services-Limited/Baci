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

interface BlogRevalidationOptions {
  identifiers?: Array<string | null | undefined>;
  listingCategories?: Array<string | null | undefined>;
  listingPages?: Array<number | null | undefined>;
  postSlugs?: Array<string | null | undefined>;
}

/**
 * Revalidate all cached data related to a merchant's products.
 * Call after product create/update/delete.
 */
export function revalidateProducts(merchantId: string, productSlug?: string) {
  // Invalidate the product list for this merchant
  revalidateTag(`products-${merchantId}`, 'products');

  // Invalidate specific product cache if slug provided
  if (productSlug) {
    revalidateTag(`product-${merchantId}-${productSlug}`, 'products');
  }

  // Invalidate product details and category page data (includes products)
  revalidateTag('product-details', 'products');
  revalidateTag('category-page-data', 'storefront-page');

  // Invalidate storefront product index (paginated listing)
  revalidateTag(`product-index-${merchantId}`, 'products');

  // Invalidate legacy product redirect cache
  revalidateTag('product-legacy-redirect', 'products');

  // Invalidate merchant feed (OpenAI, Google Merchant)
  revalidateMerchantFeed(merchantId);

  // Dashboard stats may change (revenue, inventory counts)
  revalidateTag(`dashboard-${merchantId}`, 'merchant');
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
      revalidateTag(`blog-${identifier}-${slug}`, 'merchant');
      revalidatePath(`/${identifier}/blog/${slug}`);
    }
  }
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
  revalidateTag(`merchant-feed-${merchantId}`, 'products');
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
