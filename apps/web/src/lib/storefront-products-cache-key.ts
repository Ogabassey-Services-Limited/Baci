import type { StorefrontProductsQuery } from '@/schemas/storefront-products-query.types';

export function buildStorefrontProductsCacheKeyParts(
  merchantId: string,
  filters: StorefrontProductsQuery
) {
  const cacheKeyParts = ['storefront-products', merchantId];

  if (filters.category) cacheKeyParts.push(`cat-${filters.category}`);
  if (filters.brand) {
    const normalizedBrand = filters.brand.trim().toLowerCase();
    if (normalizedBrand) {
      cacheKeyParts.push(`brand-${normalizedBrand}`);
    }
  }
  if (filters.condition) cacheKeyParts.push(`cond-${filters.condition}`);
  if (filters.min_price !== undefined) {
    cacheKeyParts.push(`min-${filters.min_price}`);
  }
  if (filters.max_price !== undefined) {
    cacheKeyParts.push(`max-${filters.max_price}`);
  }
  if (filters.limit !== undefined) {
    cacheKeyParts.push(`limit-${filters.limit}`);
  }
  if (filters.compact) {
    cacheKeyParts.push('compact');
  }
  if (filters.sort) cacheKeyParts.push(`sort-${filters.sort}`);
  if (filters.has_images) {
    cacheKeyParts.push('img-true');
  }
  if (filters.q) {
    const normalizedQuery = filters.q.trim().toLowerCase().slice(0, 100);
    if (normalizedQuery) {
      cacheKeyParts.push(`q-${normalizedQuery}`);
    }
  }

  return cacheKeyParts;
}
