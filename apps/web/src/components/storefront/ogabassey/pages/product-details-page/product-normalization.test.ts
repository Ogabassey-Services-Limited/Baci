import { describe, expect, it } from 'vitest';
import type { Product } from '../../types';
import { normalizeProductDetails } from './product-normalization';

const baseProduct = {
  id: '1',
  name: 'Test Product',
  brand: 'Test Brand',
  description: 'Test Description',
  price: '100',
  rawPrice: 100,
  condition: 'New',
  slug: 'test-product',
  image: 'https://example.com/main.jpg',
  images: ['https://example.com/img1.jpg'],
  color_images: {
    Silver: ['https://example.com/silver1.jpg'],
  },
} as unknown as Product;

describe('normalizeProductDetails', () => {
  it('passes through clean URLs correctly', () => {
    const normalized = normalizeProductDetails(baseProduct);
    expect(normalized.images).toContain('https://example.com/img1.jpg');
    expect(normalized.colorImages.Silver).toContain(
      'https://example.com/silver1.jpg',
    );
  });

  it('strips literal double quotes from image URLs', () => {
    const dirtyProduct = {
      ...baseProduct,
      image: '"https://example.com/main.jpg"',
      images: ['"https://example.com/img1.jpg"'],
      color_images: {
        Silver: ['"https://example.com/silver1.jpg"'],
      },
    } as unknown as Product;
    const normalized = normalizeProductDetails(dirtyProduct);

    expect(normalized.images).toContain('https://example.com/img1.jpg');
    expect(normalized.images).not.toContain('"https://example.com/img1.jpg"');
    expect(normalized.colorImages.Silver).toContain(
      'https://example.com/silver1.jpg',
    );
    expect(normalized.colorImages.Silver).not.toContain(
      '"https://example.com/silver1.jpg"',
    );
  });

  it('handles leading/trailing whitespace together with quotes', () => {
    const messyProduct = {
      ...baseProduct,
      images: ['  "https://example.com/extra.jpg"  '],
    } as unknown as Product;
    const normalized = normalizeProductDetails(messyProduct);
    expect(normalized.images).toContain('https://example.com/extra.jpg');
  });

  it('provides a placeholder for null/empty image values', () => {
    const emptyProduct = {
      ...baseProduct,
      image: null,
      images: [],
      color_images: { Red: null },
    } as unknown as Product;
    const normalized = normalizeProductDetails(emptyProduct);
    expect(normalized.images).toEqual(['/placeholder.svg']);
    expect(normalized.colorImages.Red).toEqual([]);
  });

  it('deduplicates images after sanitization', () => {
    const dupProduct = {
      ...baseProduct,
      images: ['https://example.com/dup.jpg', '"https://example.com/dup.jpg"'],
    } as unknown as Product;
    const normalized = normalizeProductDetails(dupProduct);
    const count = normalized.images.filter(
      (img) => img === 'https://example.com/dup.jpg',
    ).length;
    expect(count).toBe(1);
  });
});
