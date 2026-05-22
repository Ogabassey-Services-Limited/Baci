import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/storefront-product-variants', () => ({
  normalizeStorefrontProductVariants: () => [],
}));

vi.mock('@/lib/seo-utils', () => {
  const generateSlug = (value: string) =>
    value.toLowerCase().replace(/\s+/g, '-');

  return {
    generateSlug,
    getProductUrl: (product: {
      canonical_url?: string | null;
      category?: string | null;
      category_slug?: string | null;
      id: string;
      name: string;
      slug?: string | null;
    }) => {
      if (product.canonical_url) {
        try {
          return new URL(product.canonical_url, 'https://storefront.invalid')
            .pathname;
        } catch {
          // Fall back to the slug route below.
        }
      }

      const productSlug =
        product.slug ||
        (product.name ? generateSlug(product.name) : product.id);
      const categorySlug =
        product.category_slug ||
        (product.category ? generateSlug(product.category) : undefined);

      return categorySlug
        ? `/${categorySlug}/${productSlug}`
        : `/products/${productSlug}`;
    },
  };
});

import { mapLegacyCachedProductToProduct } from './legacy-product-mapper';

describe('mapLegacyCachedProductToProduct', () => {
  it('maps legacy cached products into Product shape', () => {
    const product = mapLegacyCachedProductToProduct(
      {
        id: 'prod-1',
        name: 'iPhone 15',
        description: null,
        status: 'active',
        slug: 'iphone-15',
        meta_title: 'Buy iPhone 15 in Nigeria',
        meta_description: 'Merchant-authored iPhone 15 SEO description.',
        keywords: ['iphone 15 price in nigeria', 'iphone 15'],
        sale_price: 450000,
        base_price: 500000,
        min_variant_price: 430000,
        max_variant_price: 520000,
        has_condition_offers: true,
        offers: [
          {
            id: 'offer-used',
            condition: 'used',
            price: '390000',
            stock_quantity: '2',
            images: ['https://cdn.example.com/used.jpg'],
            status: 'active',
          },
          {
            id: 'offer-inactive',
            condition: 'open_box',
            price: 375000,
            stock_quantity: 1,
            status: 'archived',
          },
        ],
        track_quantity: null,
        quantity: 4,
        images: ['https://cdn.example.com/1.jpg'],
        product_variants: [],
        product_categories: [
          {
            categories: { id: 'cat-1', name: 'Phones', slug: 'phones' },
          },
        ],
        specifications: null,
        product_key_specs: null,
      },
      'merchant-1'
    );

    expect(product).toMatchObject({
      id: 'prod-1',
      slug: 'iphone-15',
      meta_title: 'Buy iPhone 15 in Nigeria',
      meta_description: 'Merchant-authored iPhone 15 SEO description.',
      keywords: ['iphone 15 price in nigeria', 'iphone 15'],
      price: 450000,
      compare_at_price: 500000,
      min_variant_price: 430000,
      max_variant_price: 520000,
      manage_stock: false,
      stock: 4,
      category: 'Phones',
      category_slug: 'phones',
      has_condition_offers: true,
      offers: [
        {
          id: 'offer-used',
          condition: 'used',
          price: 390000,
          stock_quantity: 2,
          images: ['https://cdn.example.com/used.jpg'],
        },
      ],
      image: 'https://cdn.example.com/1.jpg',
    });
  });

  it('flattens embedded key-spec relation rows for legacy cached products', () => {
    const product = mapLegacyCachedProductToProduct(
      {
        id: 'prod-key-specs',
        name: 'iPhone 16 Pro',
        description: null,
        status: 'active',
        slug: 'iphone-16-pro',
        sale_price: null,
        base_price: 900000,
        track_quantity: true,
        quantity: 5,
        images: [],
        product_variants: [],
        product_categories: [],
        specifications: null,
        product_key_specs: [
          {
            screen_size_inches: 6.3,
            ram_gb: 8,
            storage_gb: 256,
          },
        ],
      },
      'merchant-1'
    );

    expect(product.product_key_specs).toEqual({
      screen_size_inches: 6.3,
      ram_gb: 8,
      storage_gb: 256,
    });
  });

  it('handles missing legacy category, stock, status, and optional pricing fallbacks', () => {
    const product = mapLegacyCachedProductToProduct(
      {
        id: 'prod-legacy-edge',
        name: 'Legacy Edge Phone',
        description: null,
        status: 'published',
        slug: null,
        sale_price: 0,
        base_price: 0,
        track_quantity: null,
        quantity: null,
        images: null,
        product_variants: [],
        product_categories: [{ categories: null }],
        specifications: null,
        product_key_specs: [{ unexpected: 'x' }],
      },
      'merchant-1'
    );

    expect(product).toMatchObject({
      status: 'active',
      slug: 'prod-legacy-edge',
      price: 0,
      compare_at_price: 0,
      manage_stock: false,
      stock: 0,
      category: undefined,
      category_slug: undefined,
      image: '',
    });
    expect(product.product_key_specs).toEqual({ unexpected: 'x' });
  });
});
