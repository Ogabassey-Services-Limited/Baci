import type { SupabaseClient } from '@supabase/supabase-js';
import { cacheLife, cacheTag } from 'next/cache';
import { getPublicSupabaseClient } from '@/lib/cached-data';
import { buildStorefrontClusterGuideRequest } from '@/lib/storefront-content/storefront-cluster-guide-request';
import { unwrapStorefrontReadResultForCache } from '@/lib/storefront-read-result';
import type { StorefrontDatabase } from '@/types/storefront-database';
import {
  type ProductSeoLinkData,
  readStorefrontPdpSemanticEnrichment,
} from './storefront-pdp-semantic-enrichment';

export type { ProductSeoLinkData };

// Strict local-cache SEO enrichment. Keep this unit off `use cache: remote` and
// nested remote-cache helpers. Any snapshot failure throws before this cache can
// commit; the server component degrades the optional section outside the cache.
export async function getCachedProductSeoLinkData(
  merchantId: string,
  categorySlug: string,
  productId: string,
  productSlug: string,
  productName: string,
  productBrand: string | null | undefined,
  blogEnabled: boolean
): Promise<ProductSeoLinkData> {
  'use cache';
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

  const client =
    getPublicSupabaseClient() as unknown as SupabaseClient<StorefrontDatabase>;
  const clusterRequest = buildStorefrontClusterGuideRequest({
    pageKind: 'product',
    categorySlug,
    brands: productBrand ? [productBrand] : [],
    productNames: productName ? [productName] : [],
    productSlugs: productSlug ? [productSlug] : [],
  });
  const enrichment = unwrapStorefrontReadResultForCache(
    await readStorefrontPdpSemanticEnrichment(client, {
      clusterRequest,
      includeGuides: blogEnabled,
      merchantId,
      productId,
    })
  );

  return (
    enrichment ?? {
      guidePosts: [],
      inventory: [],
      priorityGuidePostSlugs: [],
    }
  );
}
