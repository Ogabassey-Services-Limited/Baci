import { describe, expect, it } from 'vitest';
import {
  getPrimaryProductImage,
  PRODUCT_IMAGE_LARGE_PLACEHOLDER_URL,
  PRODUCT_IMAGE_PLACEHOLDER_URL,
} from '@/lib/product-image';

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

  it('skips blank image entries and returns the first valid url', () => {
    expect(
      getPrimaryProductImage([
        { url: null },
        { url: '' },
        '   ',
        { url: 'https://cdn.example.com/products/product-2.jpg' },
      ])
    ).toBe('https://cdn.example.com/products/product-2.jpg');
  });

  it('returns null when all image entries are blank', () => {
    expect(getPrimaryProductImage([{ url: null }, { url: '' }, '   '])).toBe(
      null
    );
  });

  it('rejects javascript: scheme URLs and returns null', () => {
    expect(getPrimaryProductImage(['javascript:alert(1)'])).toBeNull();
  });

  it('rejects data: scheme URLs and returns null', () => {
    expect(
      getPrimaryProductImage([{ url: 'data:text/html,<h1>hi</h1>' }])
    ).toBeNull();
  });

  it('skips unsafe URLs and returns the first safe one', () => {
    expect(
      getPrimaryProductImage([
        'javascript:void(0)',
        'data:image/png;base64,abc',
        'https://cdn.example.com/safe.jpg',
      ])
    ).toBe('https://cdn.example.com/safe.jpg');
  });

  it('accepts relative paths starting with /', () => {
    expect(getPrimaryProductImage(['/images/product.jpg'])).toBe(
      '/images/product.jpg'
    );
  });

  it('exports stable placeholder image urls', () => {
    expect(PRODUCT_IMAGE_PLACEHOLDER_URL).toBe('/placeholder.png');
    expect(PRODUCT_IMAGE_LARGE_PLACEHOLDER_URL).toBe('/placeholder.png');
  });
});
