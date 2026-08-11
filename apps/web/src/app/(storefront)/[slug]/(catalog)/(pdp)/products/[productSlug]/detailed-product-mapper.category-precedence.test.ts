import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/storefront-product-variants', () => ({
  normalizeStorefrontProductVariants: () => [],
}));

vi.mock('@/lib/seo-utils', () => ({
  generateSlug: (value: string) => value.toLowerCase().replace(/\s+/g, '-'),
  getProductUrl: (product: {
    category_slug?: string | null;
    id: string;
    slug?: string | null;
  }) =>
    product.category_slug
      ? `/${product.category_slug}/${product.slug || product.id}`
      : `/products/${product.slug || product.id}`,
}));

import { mapDetailedCachedProductToProduct } from './detailed-product-mapper';

describe('mapDetailedCachedProductToProduct category precedence', () => {
  it('uses a slug-only joined camera category before stale legacy phone text', () => {
    const product = mapDetailedCachedProductToProduct(
      {
        id: 'slug-only-camera',
        merchant_id: 'merchant-1',
        name: 'Action Camera',
        status: 'active',
        slug: 'action-camera',
        price: 100,
        images: [],
        category: 'Smartphones',
        categories: { id: 'camera-category', slug: 'action-cameras' },
        product_variants: [],
        specifications: null,
        product_key_specs: null,
      },
      'merchant-1'
    );

    expect(product).toMatchObject({
      category: 'action-cameras',
      category_slug: 'action-cameras',
      categories: { id: 'camera-category', slug: 'action-cameras' },
    });
  });

  it('derives the category slug from a name-only joined category before stale legacy text', () => {
    const product = mapDetailedCachedProductToProduct(
      {
        id: 'name-only-camera',
        merchant_id: 'merchant-1',
        name: 'Mirrorless Camera',
        status: 'active',
        slug: 'mirrorless-camera',
        price: 100,
        images: [],
        category: 'Smartphones',
        categories: { id: 'camera-category', name: 'Cameras' },
        product_variants: [],
        specifications: null,
        product_key_specs: null,
      },
      'merchant-1'
    );

    expect(product).toMatchObject({
      category: 'Cameras',
      category_slug: 'cameras',
    });
  });
});
