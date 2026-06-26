import type { PublishedClusterPost } from '@/lib/storefront-content/content-cluster-types';
import type { ProductSemanticCandidate } from '@/lib/storefront-product/product-semantic-types';
import { getSeoGuidePosts } from './get-product-seo-link-guides';
import { getProductSeoInventory } from './get-product-seo-link-inventory';

export interface ProductSeoLinkData {
  inventory: ProductSemanticCandidate[];
  guidePosts: PublishedClusterPost[];
  priorityGuidePostSlugs: string[];
}

export async function getUncachedProductSeoLinkData(
  merchantId: string,
  categorySlug: string,
  productId = ''
): Promise<ProductSeoLinkData> {
  const [inventory, { clusterGuidePosts, productGuidePosts }] =
    await Promise.all([
      getProductSeoInventory(merchantId, categorySlug, productId),
      getSeoGuidePosts(merchantId, productId, categorySlug),
    ]);
  const guidePosts = mergeGuidePosts(productGuidePosts, clusterGuidePosts);

  return {
    inventory,
    guidePosts,
    priorityGuidePostSlugs: productGuidePosts
      .map((post) => post.slug)
      .filter(Boolean),
  };
}

function mergeGuidePosts<T extends { slug: string }>(
  priorityPosts: T[],
  fallbackPosts: T[]
) {
  const seen = new Set<string>();
  const merged: T[] = [];
  for (const post of [...priorityPosts, ...fallbackPosts]) {
    if (post.slug && !seen.has(post.slug)) {
      seen.add(post.slug);
      merged.push(post);
    }
  }
  return merged;
}
