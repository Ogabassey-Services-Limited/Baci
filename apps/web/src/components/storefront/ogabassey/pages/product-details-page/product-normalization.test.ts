import { describe, expect, it } from 'vitest';
import type { Product } from '../../types';
import { normalizeProductDetails } from './product-normalization';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 1,
    name: 'Test Product',
    price: '₦50,000',
    image: '/test.jpg',
    description: 'A test product.',
    condition: 'New',
    ...overrides,
  } as unknown as Product;
}

describe('normalizeProductDetails', () => {
  it('derives colors from color_images when color_images is present', () => {
    const product = makeProduct({
      color_images: {
        Black: ['https://example.com/black.jpg'],
        Silver: ['https://example.com/silver.jpg'],
      },
    } as unknown as Partial<Product>);

    const result = normalizeProductDetails(product);

    expect(result.colors.map((c) => c.name)).toEqual(['Black', 'Silver']);
    expect(result.colors[0].value).toBe('#1a1a1a');
    expect(result.colors[1].value).toBe('#e0e0e0');
  });

  it('maps string colors to ProductColorOption objects', () => {
    const product = makeProduct({ colors: ['Gold', 'Blue'] });

    const result = normalizeProductDetails(product);

    expect(result.colors).toEqual([
      { name: 'Gold', value: '#F5E0C3' },
      { name: 'Blue', value: '#2f3d4d' },
    ]);
  });

  it('passes through object colors (already have name/value)', () => {
    const product = makeProduct({
      colors: [{ name: 'CustomRed', value: '#ff0000' }],
    });

    const result = normalizeProductDetails(product);

    expect(result.colors).toEqual([{ name: 'CustomRed', value: '#ff0000' }]);
  });

  it('wraps a single string storage value in an array', () => {
    const product = makeProduct({ storage: '128GB' });

    const result = normalizeProductDetails(product);

    expect(result.storage).toEqual(['128GB']);
  });

  it('preserves an array of storage values as-is', () => {
    const product = makeProduct({ storage: ['128GB', '256GB', '512GB'] });

    const result = normalizeProductDetails(product);

    expect(result.storage).toEqual(['128GB', '256GB', '512GB']);
  });

  it('deduplicates images that also appear in color_images', () => {
    const sharedImage = 'https://example.com/black.jpg';
    const product = makeProduct({
      images: [sharedImage],
      color_images: {
        Black: [sharedImage, 'https://example.com/black2.jpg'],
      },
    } as unknown as Partial<Product>);

    const result = normalizeProductDetails(product);

    // The shared image appears only once; the second image from color_images is appended
    expect(result.images.filter((img) => img === sharedImage)).toHaveLength(1);
    expect(result.images).toContain('https://example.com/black2.jpg');
  });

  it('falls back to /placeholder.svg when no images are provided', () => {
    const product = makeProduct({ images: [], image: '' });

    const result = normalizeProductDetails(product);

    expect(result.images).toEqual(['/placeholder.svg']);
  });

  it('defaults rating to 0 when the product has no rating', () => {
    const product = makeProduct({ rating: undefined });

    const result = normalizeProductDetails(product);

    expect(result.rating).toBe(0);
  });

  it('defaults reviewCount to 0 when the product has no reviews count', () => {
    const product = makeProduct({ reviews: undefined });

    const result = normalizeProductDetails(product);

    expect(result.reviewCount).toBe(0);
  });

  it('falls back to "No description available." when description is empty', () => {
    const product = makeProduct({ description: '' });

    const result = normalizeProductDetails(product);

    expect(result.description).toBe('No description available.');
  });

  it('normalizes "Open Box" condition to "open_box"', () => {
    const product = makeProduct({ condition: 'Open Box' });

    const result = normalizeProductDetails(product);

    expect(result.condition).toBe('open_box');
  });

  it('generates a default detailedSpecs section when no specifications are provided', () => {
    const product = makeProduct({ brand: 'Samsung', category: 'Phones' });

    const result = normalizeProductDetails(product);

    expect(result.detailedSpecs).toHaveLength(1);
    expect(result.detailedSpecs[0].category).toBe('General');
    expect(result.detailedSpecs[0].items).toEqual(
      expect.arrayContaining([
        { label: 'Brand', value: 'Samsung' },
        { label: 'Condition', value: 'New' },
        { label: 'Category', value: 'Phones' },
      ])
    );
  });
});
