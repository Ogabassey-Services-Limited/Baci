import { describe, expect, it } from 'vitest';
import type { RawDbProduct } from '@/lib/normalize-product';
import {
  mapStorefrontProduct,
  STOREFRONT_PRODUCTS_COMPACT_SELECT,
  STOREFRONT_PRODUCTS_FULL_SELECT,
} from './product-response';

describe('product-response', () => {
  it('includes canonical storefront select fragments', () => {
    expect(STOREFRONT_PRODUCTS_FULL_SELECT).toContain('category_id');
    expect(STOREFRONT_PRODUCTS_FULL_SELECT).toContain('product_categories');

    expect(STOREFRONT_PRODUCTS_COMPACT_SELECT).toContain('image_hint');
    expect(STOREFRONT_PRODUCTS_COMPACT_SELECT).toContain(
      'categories:category_id'
    );
  });

  it('maps storefront product images and defaults consistently', () => {
    const rawProduct: RawDbProduct = {
      id: 'product-1',
      name: 'Samsung Galaxy Z Fold',
      price: 1800000,
      stock: 7,
      category_id: 'cat-1',
      categories: {
        id: 'cat-1',
        name: 'Smartphones',
        slug: 'smartphones',
      },
      images: [
        'https://cdn.example.com/fold-front.png',
        {
          url: 'https://cdn.example.com/fold-back.png',
          alt: 'Rear angle',
          order: 7,
        },
        { alt: 'Missing URL' },
      ],
      color_images: {
        Black: 'https://cdn.example.com/black.png',
        Silver: 'https://cdn.example.com/silver.png',
      },
    };

    const mapped = mapStorefrontProduct(rawProduct);

    expect(mapped.manage_stock).toBe(false);
    expect(mapped.brand).toBe('');
    expect(mapped.category_id).toBe('cat-1');
    expect(mapped.categories).toEqual({
      id: 'cat-1',
      name: 'Smartphones',
      slug: 'smartphones',
    });
    expect(mapped.colors).toEqual(['Black', 'Silver']);
    expect(mapped.images).toEqual([
      {
        url: 'https://cdn.example.com/fold-front.png',
        alt: 'Samsung Galaxy Z Fold',
        order: 0,
      },
      {
        url: 'https://cdn.example.com/fold-back.png',
        alt: 'Rear angle',
        order: 7,
      },
      {
        url: '',
        alt: 'Missing URL',
        order: 2,
      },
    ]);
  });

  it('prefers explicit colors over color_images keys', () => {
    const rawProduct: RawDbProduct = {
      id: 'product-2',
      name: 'MacBook Pro',
      price: 2500000,
      stock: 3,
      category: 'Laptops',
      images: ['https://cdn.example.com/macbook.png'],
      colors: ['Space Black', 'Silver'],
      color_images: {
        Midnight: 'https://cdn.example.com/midnight.png',
      },
    };

    const mapped = mapStorefrontProduct(rawProduct);

    expect(mapped.colors).toEqual(['Space Black', 'Silver']);
  });
});
