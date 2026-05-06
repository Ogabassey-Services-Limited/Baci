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

import {
  mapDetailedCachedProductToProduct,
  mapLegacyCachedProductToProduct,
  normalizeProductImages,
} from './product-mappers';

describe('product-mappers', () => {
  it('normalizes string and object image entries', () => {
    expect(
      normalizeProductImages('iPhone 15', [
        'https://cdn.example.com/1.jpg',
        { url: 'https://cdn.example.com/2.jpg', alt: '', order: 5 },
      ])
    ).toEqual([
      {
        url: 'https://cdn.example.com/1.jpg',
        alt: 'iPhone 15',
        order: 0,
      },
      {
        url: 'https://cdn.example.com/2.jpg',
        alt: 'iPhone 15',
        order: 5,
      },
    ]);
  });

  it('maps legacy cached products into Product shape', () => {
    const product = mapLegacyCachedProductToProduct(
      {
        id: 'prod-1',
        name: 'iPhone 15',
        description: null,
        status: 'active',
        slug: 'iphone-15',
        sale_price: 450000,
        base_price: 500000,
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
      price: 450000,
      compare_at_price: 500000,
      manage_stock: false,
      stock: 4,
      category: 'Phones',
      category_slug: 'phones',
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

  it('defaults detailed products to manage_stock false while keeping stock', () => {
    const product = mapDetailedCachedProductToProduct(
      {
        id: 'prod-2',
        merchant_id: 'merchant-1',
        name: 'Galaxy S24',
        description: null,
        status: 'active',
        slug: 'galaxy-s24',
        price: '600000',
        compare_at_price: '650000',
        manage_stock: null,
        stock: 0,
        stock_quantity: '7',
        images: [],
        imageHint: null,
        brand: null,
        gtin: null,
        mpn: null,
        category: 'Smart Phones',
        categories: null,
        product_variants: [],
        specifications: null,
        product_key_specs: null,
      },
      'merchant-1'
    );

    expect(product).toMatchObject({
      slug: 'galaxy-s24',
      price: 600000,
      compare_at_price: 650000,
      manage_stock: false,
      stock: 7,
      category: 'Smart Phones',
      category_slug: 'smart-phones',
    });
  });

  it('flattens embedded key-spec relation rows for detailed cached products', () => {
    const product = mapDetailedCachedProductToProduct(
      {
        id: 'prod-detailed-key-specs',
        merchant_id: 'merchant-1',
        name: 'Galaxy S25',
        description: null,
        status: 'active',
        slug: 'galaxy-s25',
        price: 950000,
        compare_at_price: null,
        manage_stock: true,
        stock: 3,
        stock_quantity: 3,
        images: [],
        imageHint: null,
        brand: null,
        gtin: null,
        mpn: null,
        category: 'Phones',
        categories: null,
        product_variants: [],
        specifications: null,
        product_key_specs: [
          {
            chipset: 'Snapdragon',
            has_5g: true,
            battery_mah: 5000,
          },
        ],
      },
      'merchant-1'
    );

    expect(product.product_key_specs).toEqual({
      chipset: 'Snapdragon',
      has_5g: true,
      battery_mah: 5000,
    });
  });

  it('extracts primary category from categories array', () => {
    const detailedProduct = {
      id: 'prod-3',
      merchant_id: 'merchant-1',
      name: 'Pixel 9',
      description: null,
      status: 'active',
      slug: 'pixel-9',
      price: 700000,
      compare_at_price: null,
      manage_stock: true,
      stock: 3,
      stock_quantity: 3,
      images: [],
      imageHint: null,
      brand: null,
      gtin: null,
      mpn: null,
      category: null,
      categories: [
        {
          id: 'cat-2',
          name: 'Smartphones',
          slug: 'smartphones',
          parent_id: null,
        },
        {
          id: 'cat-3',
          name: 'Android Phones',
          slug: 'android-phones',
          parent_id: 'cat-2',
        },
      ],
      product_variants: [],
      specifications: null,
      product_key_specs: null,
      internal_only_flag: 'should-not-leak',
    };

    const product = mapDetailedCachedProductToProduct(
      detailedProduct,
      'merchant-1'
    );

    expect(product).toMatchObject({
      category: 'Smartphones',
      category_slug: 'smartphones',
      categories: {
        id: 'cat-2',
        name: 'Smartphones',
        slug: 'smartphones',
        parent_id: undefined,
      },
    });
    expect(product).not.toHaveProperty('internal_only_flag');
  });

  it('maps has_condition_offers and offers from detailed product', () => {
    const product = mapDetailedCachedProductToProduct(
      {
        id: 'prod-4',
        merchant_id: 'merchant-1',
        name: 'iPhone 14',
        description: null,
        status: 'active',
        slug: 'iphone-14',
        price: 800000,
        compare_at_price: null,
        manage_stock: false,
        stock: 10,
        stock_quantity: 10,
        images: [],
        imageHint: null,
        brand: null,
        gtin: null,
        mpn: null,
        category: 'Phones',
        categories: null,
        product_variants: [],
        specifications: null,
        product_key_specs: null,
        has_condition_offers: true,
        offers: [
          {
            id: 'o1',
            condition: 'used',
            price: 500000,
            stock_quantity: 9999,
          },
        ],
      },
      'merchant-1'
    );

    expect(product.has_condition_offers).toBe(true);
    expect(product.offers).toEqual([
      {
        id: 'o1',
        condition: 'used',
        price: 500000,
        stock_quantity: 9999,
      },
    ]);
  });
});
