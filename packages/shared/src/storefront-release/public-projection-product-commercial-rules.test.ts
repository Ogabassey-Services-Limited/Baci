import { describe, expect, it } from 'vitest';
import { StorefrontPublicProjectionPayloadSchema } from './public-projection-payload-schema';
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

describe('StorefrontPublicProductSchema commercial rules', () => {
  it('preserves simple-product condition and product-specific ratings', () => {
    const payload = {
      merchant: {
        country: 'NG',
        currency: 'NGN',
        hostname: 'pilot-store.usebaci.com',
        id: '123e4567-e89b-42d3-a456-426614174000',
        locale: 'en-NG',
        name: 'Pilot Store',
        publishedStatus: 'published',
        slug: 'pilot-store',
        template: { contractVersion: 'v1', id: 'ogabassey' },
      },
      products: [
        {
          ...product,
          compareAtPriceMinor: 125_000,
          condition: 'used',
          displayQuantityLimit: 4,
          rating: 4.5,
          ratingCount: 12,
          reviewCount: 10,
        },
      ],
      publishedConfig: { content: [], root: { props: { title: 'Home' } } },
    } as const;

    expect(StorefrontPublicProjectionPayloadSchema.parse(payload)).toEqual(
      payload
    );
  });

  it('normalizes legacy conditions and preserves unique available conditions', () => {
    const parsed = StorefrontPublicProductSchema.parse({
      ...product,
      availableConditions: ['refurbished'],
      condition: 'refurbished',
    });

    expect(parsed.condition).toBe('open_box');
    expect(parsed.availableConditions).toEqual(['open_box']);
    expect(
      StorefrontPublicProductSchema.safeParse({
        ...product,
        availableConditions: ['open_box', 'refurbished'],
      }).success
    ).toBe(false);
  });

  it('rejects compare-at prices that do not exceed their selling price', () => {
    expect(
      StorefrontPublicProductSchema.safeParse({
        ...product,
        compareAtPriceMinor: product.priceMinor,
      }).success
    ).toBe(false);
    expect(
      StorefrontPublicProductSchema.safeParse({
        ...product,
        variants: [
          {
            available: true,
            compareAtPriceMinor: 90_000,
            displayQuantityLimit: 1,
            id: '123e4567-e89b-42d3-a456-426614174017',
            name: 'Black',
            priceMinor: 100_000,
          },
        ],
      }).success
    ).toBe(false);
    expect(
      StorefrontPublicProductSchema.safeParse({
        ...product,
        conditionOffers: [
          {
            available: true,
            compareAtPriceMinor: 90_000,
            condition: 'used',
            displayQuantityLimit: 1,
            id: '123e4567-e89b-42d3-a456-426614174018',
            priceMinor: 90_000,
            status: 'active',
          },
        ],
        hasConditionOffers: true,
      }).success
    ).toBe(false);
  });

  it('rejects variants that collide after inheriting the product condition', () => {
    expect(
      StorefrontPublicProductSchema.safeParse({
        ...product,
        condition: 'new',
        variants: [
          {
            available: true,
            condition: null,
            displayQuantityLimit: 1,
            id: '123e4567-e89b-42d3-a456-426614174019',
            name: 'Inherited new',
            priceMinor: 100_000,
          },
          {
            available: true,
            condition: 'new',
            displayQuantityLimit: 1,
            id: '123e4567-e89b-42d3-a456-426614174020',
            name: 'Explicit new',
            priceMinor: 100_000,
          },
        ],
      }).success
    ).toBe(false);
  });
});
