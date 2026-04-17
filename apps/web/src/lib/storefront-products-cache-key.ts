import type { StorefrontProductsQuery } from '@/schemas/storefront-products-query.types';

export function buildStorefrontProductsCacheKeyParts(
  merchantId: string,
  filters: StorefrontProductsQuery
) {
  const cacheKeyParts = ['storefront-products', merchantId];

  if (filters.category) cacheKeyParts.push(`cat-${filters.category}`);
  if (filters.brand) cacheKeyParts.push(`brand-${filters.brand}`);
  if (filters.condition) cacheKeyParts.push(`cond-${filters.condition}`);
  if (filters.min_price) cacheKeyParts.push(`min-${filters.min_price}`);
  if (filters.max_price) cacheKeyParts.push(`max-${filters.max_price}`);
  if (filters.sort) cacheKeyParts.push(`sort-${filters.sort}`);
  if (filters.has_images !== undefined) {
    cacheKeyParts.push(`img-${String(filters.has_images)}`);
  }
  if (filters.q) {
    cacheKeyParts.push(`q-${filters.q.slice(0, 100).toLowerCase().trim()}`);
  }

  return cacheKeyParts;
}
