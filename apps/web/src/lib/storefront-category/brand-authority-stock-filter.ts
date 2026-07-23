import { normalizeProduct, type RawDbProduct } from '@/lib/normalize-product';

/**
 * Uses the same post-hydration availability calculation as public storefront
 * product cards. This matters for serialized inventory, whose public stock can
 * differ from the stale product-table columns.
 */
export function isBrandAuthorityProductInStock(product: RawDbProduct): boolean {
  return normalizeProduct(product).availability === 'InStock';
}
