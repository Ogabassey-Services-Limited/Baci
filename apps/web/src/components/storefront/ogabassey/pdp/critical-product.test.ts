import { describe, expect, it } from 'vitest';
import {
  buildOgabasseyPdpCriticalProduct,
  getOgabasseyPdpPrimaryImage,
} from './critical-product';

describe('buildOgabasseyPdpCriticalProduct', () => {
  it('maps cached product fields without requiring a review_count column', () => {
    const product = buildOgabasseyPdpCriticalProduct({
      brand: 'Lenovo',
      category: 'Laptops',
      categories: { id: 'cat-1', name: 'Laptops', slug: 'laptops' },
      condition: 'used',
      id: 'product-1',
      images: [
        { url: 'https://cdn.ogabassey.com/core-assets/products/legion.avif' },
      ],
      name: 'Lenovo Legion Pro 9',
      price: '5985000',
      schema_markup: {
        aggregateRating: {
          ratingValue: '4.5',
          reviewCount: '12',
        },
      },
      slug: 'lenovo-legion-pro-9',
      stock_quantity: 3,
    });

    expect(product).toMatchObject({
      brand: 'Lenovo',
      categoryName: 'Laptops',
      categorySlug: 'laptops',
      condition: 'used',
      id: 'product-1',
      image: 'https://cdn.ogabassey.com/core-assets/products/legion.avif',
      name: 'Lenovo Legion Pro 9',
      price: 5_985_000,
      rating: 4.5,
      reviewCount: 12,
      slug: 'lenovo-legion-pro-9',
      stockQuantity: 3,
    });
  });

  it('falls back to legacy string image arrays', () => {
    expect(
      getOgabasseyPdpPrimaryImage({
        images: ['https://cdn.ogabassey.com/core-assets/products/iphone.avif'],
      })
    ).toBe('https://cdn.ogabassey.com/core-assets/products/iphone.avif');
  });

  it('keeps rating-count-only aggregate ratings visible without claiming reviews', () => {
    const product = buildOgabasseyPdpCriticalProduct({
      category: 'Smartphones',
      id: 'product-2',
      name: 'Rating Count Product',
      price: 100,
      schema_markup: {
        aggregateRating: {
          ratingValue: 4.5,
          reviewCount: 0,
          ratingCount: 12,
        },
      },
    });

    expect(product.rating).toBe(4.5);
    expect(product.reviewCount).toBe(0);
    expect(product.ratingCount).toBe(12);
  });

  it('ignores aggregate ratings that use a non-storefront rating scale', () => {
    const product = buildOgabasseyPdpCriticalProduct({
      category: 'Smartphones',
      id: 'product-3',
      name: 'Hundred Point Rating Product',
      price: 100,
      schema_markup: {
        aggregateRating: {
          bestRating: 100,
          worstRating: 0,
          ratingValue: 87,
          ratingCount: 12,
        },
      },
    });

    expect(product.rating).toBe(0);
    expect(product.reviewCount).toBe(0);
    expect(product.ratingCount).toBe(0);
  });

  it('uses safe defaults for legacy rows without schema markup or condition', () => {
    const product = buildOgabasseyPdpCriticalProduct({
      category: null,
      condition: null,
      id: 'legacy-product',
      images: null,
      name: 'Legacy Product',
      price: null,
      schema_markup: null,
      stock_quantity: null,
    });

    expect(product).toMatchObject({
      brand: 'OgaBassey',
      categoryName: 'Electronics',
      categorySlug: 'electronics',
      condition: 'new',
      image: '/placeholder.png',
      price: 0,
      rating: 0,
      ratingCount: 0,
      reviewCount: 0,
      slug: 'legacy-product',
      stockQuantity: null,
    });
  });
});
