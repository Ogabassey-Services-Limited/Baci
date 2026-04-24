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
    expect(normalized.colorImages).toEqual({});
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

  it('treats variant media as the canonical image-driven color mapping', () => {
    const variantMediaProduct = {
      ...baseProduct,
      colors: ['Silver', 'Gold'],
      images: ['https://example.com/generic.jpg'],
      color_images: {
        Silver: ['https://example.com/legacy-silver.jpg'],
      },
      variants: [
        {
          id: 'variant-silver',
          attributes: { color: 'Silver', storage: '64GB' },
          primary_image: 'https://example.com/silver.jpg',
        },
        {
          id: 'variant-gold',
          attributes: { color: 'Gold', storage: '64GB' },
          primary_image: 'https://example.com/gold.jpg',
        },
      ],
    } as unknown as Product;

    const normalized = normalizeProductDetails(variantMediaProduct);

    expect(normalized.colorImages).toEqual({
      Gold: ['https://example.com/gold.jpg'],
      Silver: ['https://example.com/silver.jpg'],
    });
    expect(normalized.images).toEqual([
      'https://example.com/silver.jpg',
      'https://example.com/gold.jpg',
      'https://example.com/generic.jpg',
      'https://example.com/main.jpg',
    ]);
  });

  it('falls back to product color_images when a variant color has no primary image', () => {
    const variantWithoutPrimaryImage = {
      ...baseProduct,
      color_images: {
        Silver: ['https://example.com/legacy-silver.jpg'],
      },
      variants: [
        {
          id: 'variant-silver',
          attributes: { color: 'Silver', storage: '64GB' },
          primary_image: null,
        },
      ],
    } as unknown as Product;

    const normalized = normalizeProductDetails(variantWithoutPrimaryImage);

    expect(normalized.colorImages.Silver).toEqual([
      'https://example.com/legacy-silver.jpg',
    ]);
  });

  it('derives summary specs and general details from variant attributes when explicit specs are missing', () => {
    const productWithVariantAttributes = {
      ...baseProduct,
      category: 'Smartphones',
      condition: 'new',
      variant_attributes: {
        ram: ['16GB'],
        storage: ['512GB'],
        sim_type: ['Physical + eSIM'],
      },
      specs: [],
      detailedSpecs: [],
      specifications: [],
    } as unknown as Product;

    const normalized = normalizeProductDetails(productWithVariantAttributes);

    expect(normalized.specs).toEqual(
      expect.arrayContaining([
        { label: 'RAM', value: '16GB' },
        { label: 'Storage', value: '512GB' },
        { label: 'SIM', value: 'Physical + eSIM' },
      ])
    );

    expect(normalized.detailedSpecs).toEqual([
      {
        category: 'General',
        items: expect.arrayContaining([
          { label: 'Brand', value: 'Test Brand' },
          { label: 'Condition', value: 'new' },
          { label: 'Category', value: 'Smartphones' },
          { label: 'RAM', value: '16GB' },
          { label: 'Storage', value: '512GB' },
          { label: 'SIM', value: 'Physical + eSIM' },
        ]),
      },
    ]);
  });
});
