import { cacheLife, cacheTag } from 'next/cache';
import {
  getUncachedProductSeoLinkData,
  type ProductSeoLinkData,
} from './get-product-seo-link-direct-data';

export type { ProductSeoLinkData };

// Strict local-cache SEO enrichment. Keep this unit off `use cache: remote` and
// off nested remote-cache helpers: inventory errors throw so degraded link-poor
// data is not cached, while non-critical guide-post reads fail open to [].
export async function getCachedProductSeoLinkData(
  merchantId: string,
  categorySlug: string,
  _storeSlug: string,
  productId = ''
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

  return await getUncachedProductSeoLinkData(
    merchantId,
    categorySlug,
    productId
  );
}
