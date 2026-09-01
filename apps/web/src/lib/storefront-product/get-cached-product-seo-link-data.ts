import type { SupportedClusterCategory } from '@/lib/storefront-content/content-cluster-types';
import { getPublishedClusterPosts } from '@/lib/storefront-content/get-published-cluster-posts';
import { getCachedPdpProductGuidePosts } from './get-cached-pdp-product-guide-posts';
import { getCachedPdpSemanticInventory } from './get-cached-pdp-semantic-inventory';
import { runStorefrontPdpSemanticRpcWithCooldown } from './run-storefront-pdp-semantic-rpc-with-cooldown';
import type { ProductSeoLinkData } from './storefront-pdp-semantic-enrichment';
import { storefrontPdpSemanticReadCooldown } from './storefront-pdp-semantic-read-cooldown-singleton';

export type { ProductSeoLinkData };

function isValidPublishedClusterPost(
  value: unknown
): value is ProductSeoLinkData['guidePosts'][number] {
  if (!value || typeof value !== 'object') return false;

  const post = value as Record<string, unknown>;
  const isNullableString = (field: unknown) =>
    field === null || typeof field === 'string';
  const isNullableStringArray = (field: unknown) =>
    field === null ||
    (Array.isArray(field) && field.every((item) => typeof item === 'string'));
  const isNullableFiniteNumber = (field: unknown) =>
    field === null || (typeof field === 'number' && Number.isFinite(field));

  return (
    typeof post.slug === 'string' &&
    post.slug.trim() !== '' &&
    typeof post.title === 'string' &&
    post.title.trim() !== '' &&
    isNullableString(post.excerpt) &&
    isNullableString(post.category) &&
    isNullableStringArray(post.tags) &&
    isNullableStringArray(post.keywords) &&
    isNullableString(post.featured_image_url) &&
    isNullableString(post.published_at) &&
    isNullableFiniteNumber(post.reading_time_minutes)
  );
}

// This function deliberately owns no cache directive. Its three bounded reads
// have different reuse keys and freshness windows: category inventory is shared
// by every PDP in a category, cluster guides are shared by their context, and
// product-linked guides are keyed by product. Keeping orchestration uncached
// means a partial guide failure cannot be persisted as a complete empty model.
export async function getCachedProductSeoLinkData(
  merchantId: string,
  categorySlug: string,
  storeSlug: string,
  productId: string,
  productSlug: string,
  productName: string,
  productBrand: string | null | undefined,
  blogEnabled: boolean
): Promise<ProductSeoLinkData> {
  // Inventory is the only required leg. Do not fan out two more Supabase
  // reads while it is already timing out; once it succeeds, the optional guide
  // legs run in parallel and can fail open independently.
  const inventoryScope = `${merchantId}:${categorySlug}`;
  const inventory = storefrontPdpSemanticReadCooldown.isCoolingDown(
    inventoryScope
  )
    ? []
    : (
        await runStorefrontPdpSemanticRpcWithCooldown(
          getCachedPdpSemanticInventory(merchantId, categorySlug, storeSlug),
          { deadlineMs: 5_000, traceThresholdMs: 1_000 },
          inventoryScope
        )
      ).response;

  if (!blogEnabled) {
    return {
      guidePosts: [],
      inventory,
      priorityGuidePostSlugs: [],
    };
  }

  const clusterGuidePromise = getPublishedClusterPosts(merchantId, {
    brands: productBrand ? [productBrand] : [],
    categorySlug: categorySlug as SupportedClusterCategory,
    pageKind: 'product',
    productNames: productName ? [productName] : [],
    productSlugs: productSlug ? [productSlug] : [],
  })
    .then((posts) => posts.filter(isValidPublishedClusterPost))
    .catch((error: unknown) => {
      console.warn('Failed to load PDP cluster guide posts', {
        categorySlug,
        error,
        merchantId,
      });
      return [];
    });
  const productGuidePromise = getCachedPdpProductGuidePosts(
    merchantId,
    productId
  ).catch((error: unknown) => {
    console.warn('Failed to load PDP product guide posts', {
      error,
      merchantId,
      productId,
    });
    return [];
  });

  const [clusterGuidePosts, productGuidePosts] = await Promise.all([
    clusterGuidePromise,
    productGuidePromise,
  ]);
  const guidePosts = mergeGuidePosts(productGuidePosts, clusterGuidePosts);

  return {
    guidePosts,
    inventory,
    priorityGuidePostSlugs: productGuidePosts.map((post) => post.slug),
  };
}

function mergeGuidePosts(
  productGuidePosts: ProductSeoLinkData['guidePosts'],
  clusterGuidePosts: ProductSeoLinkData['guidePosts']
): ProductSeoLinkData['guidePosts'] {
  const seen = new Set<string>();
  return [...productGuidePosts, ...clusterGuidePosts].filter((post) => {
    if (seen.has(post.slug)) return false;
    seen.add(post.slug);
    return true;
  });
}
