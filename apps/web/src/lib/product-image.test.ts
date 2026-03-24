import { describe, expect, it } from 'vitest';
import {
  getPrimaryProductImage,
  PRODUCT_IMAGE_LARGE_PLACEHOLDER_URL,
  PRODUCT_IMAGE_PLACEHOLDER_URL,
} from './product-image';

describe('product-image', () => {
  it('returns null for missing or empty images', () => {
    expect(getPrimaryProductImage([])).toBeNull();
    expect(getPrimaryProductImage(null)).toBeNull();
    expect(getPrimaryProductImage(undefined)).toBeNull();
  });

  it('returns the first image string when images is a string array', () => {
    expect(
      getPrimaryProductImage([
        'https://cdn.example.com/products/product-1.jpg',
        'https://cdn.example.com/products/product-2.jpg',
      ])
    ).toBe('https://cdn.example.com/products/product-1.jpg');
  });

  it('returns the first image url when images is an object array', () => {
    expect(
      getPrimaryProductImage([
        { url: 'https://cdn.example.com/products/product-1.jpg' },
        { url: 'https://cdn.example.com/products/product-2.jpg' },
      ])
    ).toBe('https://cdn.example.com/products/product-1.jpg');
  });

  it('exports stable placeholder image urls', () => {
    expect(PRODUCT_IMAGE_PLACEHOLDER_URL).toBe(
      'https://picsum.photos/seed/placeholder/80/80'
    );
    expect(PRODUCT_IMAGE_LARGE_PLACEHOLDER_URL).toBe(
      'https://picsum.photos/seed/placeholder/600/400'
    );
  });
});
