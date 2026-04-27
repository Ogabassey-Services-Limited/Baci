import { describe, expect, it } from 'vitest';
import type { Product as StorefrontProduct } from '@/lib/products';
import { mapStorefrontProductsToOgabasseyProducts } from './home-product-feed';

function createStorefrontProduct(
  overrides: Partial<StorefrontProduct>
): StorefrontProduct {
  return {
    id: 'product-1',
    name: 'Test Product',
    description: 'Test description',
    status: 'active',
    price: 100000,
    manage_stock: true,
    stock: 5,
    image: '/default.jpg',
    imageLarge: '/default-large.jpg',
    imageHint: 'Test product',
    brand: 'Baci',
    gtin: '',
    mpn: '',
    ...overrides,
  };
}

describe('mapStorefrontProductsToOgabasseyProducts', () => {
  it('maps storefront products into the compact Ogabassey card-feed shape', () => {
    const result = mapStorefrontProductsToOgabasseyProducts([
      createStorefrontProduct({
        id: 'iphone-1',
        name: 'iPhone 17 Pro Max',
        slug: 'iphone-17-pro-max',
        description: 'Flagship phone',
        price: 2100000,
        rating: 4.9,
        category: 'Smartphones',
        category_id: 'cat-1',
        category_slug: 'smartphones',
        categories: {
          id: 'cat-1',
          name: 'Smartphones',
          slug: 'smartphones',
        },
        condition: 'open_box',
        colors: ['Black', 'Gold'],
        storage_options: ['512GB'],
        images: [
          { url: '/iphone-black.jpg', alt: 'Black', order: 0 },
          { url: '/iphone-gold.jpg', alt: 'Gold', order: 1 },
        ],
      }),
    ]);

    expect(result).toEqual([
      expect.objectContaining({
        id: 'iphone-1',
        slug: 'iphone-17-pro-max',
        name: 'iPhone 17 Pro Max',
        price: '₦2,100,000',
        rawPrice: 2100000,
        image: '/default.jpg',
        description: 'Flagship phone',
        rating: 4.9,
        category: 'Smartphones',
        categorySlug: 'smartphones',
        condition: 'Open Box',
        colors: ['Black', 'Gold'],
        storage: '512GB',
        images: ['/iphone-black.jpg', '/iphone-gold.jpg'],
      }),
    ]);
  });

  it('marks condition-offer products as New & Used and falls back sensibly', () => {
    const result = mapStorefrontProductsToOgabasseyProducts([
      createStorefrontProduct({
        id: 'mixed-1',
        name: 'Galaxy S30',
        price: 950000,
        category: undefined,
        categories: null,
        image: '',
        has_condition_offers: true,
        images: [{ url: '/galaxy.jpg', alt: 'Galaxy', order: 0 }],
      }),
    ]);

    expect(result[0]).toEqual(
      expect.objectContaining({
        category: 'General',
        condition: 'New & Used',
        image: '/galaxy.jpg',
        has_condition_offers: true,
      })
    );
  });
});
