import { describe, expect, it } from 'vitest';
import { StorefrontPublicProductSchema } from './public-projection-product-schema';

const product = {
  available: true,
  currency: 'NGN',
  displayQuantityLimit: null,
  id: '123e4567-e89b-42d3-a456-426614174001',
  name: 'Phone',
  priceMinor: 100_000,
  slug: 'phone',
  status: 'active',
} as const;

describe('StorefrontPublicProductSchema fidelity', () => {
  it('preserves bounded simple identifiers and structured specifications', () => {
    const value = {
      ...product,
      canonicalPath: '/phones/phone',
      gtin: '1234567890123',
      mpn: 'MPN-001',
      primaryCategoryId: '123e4567-e89b-42d3-a456-426614174099',
      productKeySpecs: {
        chipset: 'Snapdragon 8',
        has_5g: true,
        storage_gb: 256,
        recommended_for: ['gaming', 'photography'],
      },
      attributeAxes: ['Platform', 'storage'],
      storageOptions: ['128GB', '256GB'],
      sku: 'SKU-001',
      specifications: [
        {
          category: 'Display',
          items: [{ label: 'Size', value: '6.7 inches' }],
        },
      ],
      variantAttributes: { Platform: ['Android', 'iOS'], storage: ['256GB'] },
    };

    expect(StorefrontPublicProductSchema.parse(value)).toEqual(value);
  });

  it('preserves launch ordering and legacy color galleries', () => {
    const value = {
      ...product,
      colorGalleries: [
        {
          color: 'Black',
          mediaIds: ['123e4567-e89b-42d3-a456-426614174090'],
        },
      ],
      createdAt: '2026-08-25T14:00:00+01:00',
    } as const;

    expect(StorefrontPublicProductSchema.parse(value)).toEqual(value);
  });

  it('rejects an available-condition summary that contradicts the selection model', () => {
    expect(
      StorefrontPublicProductSchema.safeParse({
        ...product,
        availableConditions: ['used'],
        condition: 'new',
      }).success
    ).toBe(false);
    expect(
      StorefrontPublicProductSchema.safeParse({
        ...product,
        availableConditions: ['new'],
        conditionOffers: [
          {
            available: true,
            condition: 'used',
            displayQuantityLimit: 1,
            id: '123e4567-e89b-42d3-a456-426614174002',
            priceMinor: 90_000,
            status: 'active',
          },
        ],
        hasConditionOffers: true,
      }).success
    ).toBe(false);
  });

  it('canonicalizes variant attribute key order', () => {
    const parsed = StorefrontPublicProductSchema.parse({
      ...product,
      variants: [
        {
          attributes: { storage: '128 GB', color: 'Red' },
          available: true,
          displayQuantityLimit: 1,
          id: '123e4567-e89b-42d3-a456-426614174003',
          name: 'Red / 128 GB',
          priceMinor: 100_000,
        },
      ],
    });

    expect(Object.keys(parsed.variants?.[0]?.attributes ?? {})).toEqual([
      'color',
      'storage',
    ]);
  });

  it('canonicalizes non-ASCII variant axes independently of host locale', () => {
    const parsed = StorefrontPublicProductSchema.parse({
      ...product,
      variants: [
        {
          attributes: { z: 'last', ä: 'accented' },
          available: true,
          displayQuantityLimit: 1,
          id: '123e4567-e89b-42d3-a456-426614174005',
          name: 'Unicode axes',
          priceMinor: 100_000,
        },
      ],
    });

    expect(Object.keys(parsed.variants?.[0]?.attributes ?? {})).toEqual([
      'z',
      'ä',
    ]);
  });

  it('rejects attribute aliases that collide after key normalization', () => {
    expect(
      StorefrontPublicProductSchema.safeParse({
        ...product,
        variants: [
          {
            attributes: { Color: 'Red', color: 'Blue' },
            available: true,
            displayQuantityLimit: 1,
            id: '123e4567-e89b-42d3-a456-426614174004',
            name: 'Conflicting colors',
            priceMinor: 100_000,
          },
        ],
      }).success
    ).toBe(false);
  });

  it('rejects product slugs owned by category-level static routes', () => {
    expect(
      StorefrontPublicProductSchema.safeParse({
        ...product,
        slug: 'compare',
      }).success
    ).toBe(false);
  });

  it('rejects canonical paths for another route or product', () => {
    expect(
      StorefrontPublicProductSchema.safeParse({
        ...product,
        canonicalPath: '/about',
      }).success
    ).toBe(false);
    expect(
      StorefrontPublicProductSchema.safeParse({
        ...product,
        canonicalPath: '/phones/another-product',
      }).success
    ).toBe(false);
  });
});
