import { cacheLife, cacheTag } from 'next/cache';
import type { PublishedClusterPost } from '@/lib/storefront-content/content-cluster-types';
import { getPublishedClusterPosts } from '@/lib/storefront-content/get-published-cluster-posts';
import { getPublishedProductGuidePosts } from '@/lib/storefront-content/get-published-product-guide-posts';
import { getCachedProductSemanticInventory } from '@/lib/storefront-product/get-cached-product-semantic-inventory';
import type { ProductSemanticCandidate } from '@/lib/storefront-product/product-semantic-types';

export interface ProductSeoLinkData {
  inventory: ProductSemanticCandidate[];
  guidePosts: PublishedClusterPost[];
  priorityGuidePostSlugs: string[];
}

/**
 * Strict, cache-isolated fetch of the data that powers the PDP's semantic SEO
 * internal links (compare / brand / price-band support links + guide links).
 *
 * Why this exists — the reliability pattern (Next 16 Cache Components):
 *   `getCachedCategoryPageData` deliberately FAILS OPEN: on transient Supabase
 *   errors (e.g. the 10s query timeout) it returns `products: []` plus
 *   `productsQueryFailed` / `categoryQueryFailed` flags so category pages don't
 *   404. But that degraded result is cached (`'use cache'` +
 *   cacheLife('products')), which would cache a *link-poor* PDP until the next
 *   revalidate.
 *
 *   Here we re-read that flag and THROW on a transient failure. Because this
 *   function is its own `'use cache'` boundary, a throw means its cache entry is
 *   NOT overwritten: Next.js keeps serving this unit's last-good value
 *   (stale-while-revalidate) and retries on the next revalidate — self-healing,
 *   never caching a degraded set of SEO links. On a genuinely empty category
 *   (no rows, no error) the flag is false, so we cache the empty result as
 *   normal.
 *
 *   Consumers must render this behind a Suspense boundary AND an error boundary
 *   so the cold-cache case (no last-good value yet + a transient failure)
 *   degrades to "no semantic links" instead of failing the whole PDP.
 *
 * NOTE (prototype): only the inventory path is made strict here. Guide-post
 * fetches still fail open (return []); giving them the same flag + strict
 * treatment is a follow-up.
 */
export async function getCachedProductSeoLinkData(
  merchantId: string,
  categorySlug: string,
  _storeSlug: string,
  productId = ''
): Promise<ProductSeoLinkData> {
  'use cache: remote';
  try {
    cacheLife('products');
    cacheTag(
      'products',
      `products-${merchantId}`,
      'blog-posts',
      `seo-links-${merchantId}-${categorySlug}-${productId || 'category'}`
    );
  } catch {
    // Unit tests do not run with Next cacheComponents enabled.
  }

  const [inventory, clusterGuidePosts, productGuidePosts] = await Promise.all([
    getCachedProductSemanticInventory(merchantId, categorySlug),
    getPublishedClusterPosts(merchantId),
    getPublishedProductGuidePosts(merchantId, productId),
  ]);
  const guidePosts = mergeGuidePosts(productGuidePosts, clusterGuidePosts);
  const priorityGuidePostSlugs = productGuidePosts
    .map((post) => post.slug)
    .filter(Boolean);

  return { inventory, guidePosts, priorityGuidePostSlugs };
}

function mergeGuidePosts<T extends { slug: string }>(
  priorityPosts: T[],
  fallbackPosts: T[]
): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];

  for (const post of [...priorityPosts, ...fallbackPosts]) {
    if (!post.slug || seen.has(post.slug)) {
      continue;
    }

    seen.add(post.slug);
    merged.push(post);
  }

  return merged;
}
