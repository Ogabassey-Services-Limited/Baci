import { cacheLife, cacheTag } from 'next/cache';
import { getCachedCategoryPageData } from '@/lib/cached-data';
import type { PublishedClusterPost } from '@/lib/storefront-content/content-cluster-types';
import { getPublishedClusterPosts } from '@/lib/storefront-content/get-published-cluster-posts';
import { getPublishedProductGuidePosts } from '@/lib/storefront-content/get-published-product-guide-posts';
import type { ProductSemanticCandidate } from '@/lib/storefront-product/product-semantic-types';

export interface ProductSeoLinkData {
  inventory: ProductSemanticCandidate[];
  guidePosts: PublishedClusterPost[];
}

/**
 * Strict, cache-isolated fetch of the data that powers the PDP's semantic SEO
 * internal links (compare / brand / price-band support links + guide links).
 *
 * Why this exists — the reliability pattern (Next 16 Cache Components):
 *   `getCachedCategoryPageData` deliberately FAILS OPEN: on a transient Supabase
 *   error (e.g. the 10s query timeout) it returns `products: []` plus a
 *   `productsQueryFailed` flag so category pages don't 404. But that empty
 *   result is cached (`'use cache'` + cacheLife('products')), which would cache
 *   a *link-poor* PDP until the next revalidate.
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
  storeSlug: string,
  productId = ''
): Promise<ProductSeoLinkData> {
  'use cache: remote';
  cacheLife('products');
  cacheTag(
    'products',
    `seo-links-${merchantId}-${categorySlug}-${productId || 'category'}`
  );

  const [categoryPageData, clusterGuidePosts, productGuidePosts] =
    await Promise.all([
      getCachedCategoryPageData(merchantId, categorySlug, storeSlug),
      getPublishedClusterPosts(merchantId),
      getPublishedProductGuidePosts(merchantId, productId),
    ]);
  const guidePosts = mergeGuidePosts(productGuidePosts, clusterGuidePosts);

  // `productsQueryFailed` only exists on the non-collection result shape.
  const productResult =
    categoryPageData && !categoryPageData.isCollection
      ? categoryPageData
      : null;

  if (productResult?.productsQueryFailed) {
    // Transient inventory failure — do NOT cache a link-poor result. Throwing
    // preserves this unit's last-good cache entry via stale-while-revalidate.
    throw new Error(
      `Product SEO link inventory unavailable (transient) for merchant ${merchantId} / ${categorySlug}`
    );
  }

  const rawProducts: unknown[] = productResult?.products ?? [];
  const inventory = rawProducts
    .filter(isProductSemanticCandidate)
    .map(toProductSemanticCandidate);

  return { inventory, guidePosts };
}

function isProductSemanticCandidate(
  candidate: unknown
): candidate is ProductSemanticCandidate {
  if (!candidate || typeof candidate !== 'object') {
    return false;
  }

  const product = candidate as Record<string, unknown>;
  return (
    typeof product.slug === 'string' &&
    typeof product.name === 'string' &&
    typeof product.price === 'number'
  );
}

function toProductSemanticCandidate(
  product: ProductSemanticCandidate
): ProductSemanticCandidate {
  return {
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    condition: product.condition,
    price: product.price,
    stock: product.stock,
    category_slug: product.category_slug,
    product_key_specs: product.product_key_specs,
  };
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
