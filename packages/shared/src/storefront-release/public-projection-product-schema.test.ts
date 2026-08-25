import { describe, expect, it } from 'vitest';
import { StorefrontPublicProductSchema } from './public-projection-product-schema';

const product = {
  available: true,
  currency: 'NGN',
  id: '123e4567-e89b-42d3-a456-426614174001',
  name: 'Phone',
  priceMinor: 100_000,
  slug: 'phone',
  status: 'active',
} as const;

describe('StorefrontPublicProductSchema', () => {
  it('preserves variant comparison prices and active condition offers', () => {
    const value = {
      ...product,
      conditionOffers: [
        {
          available: true,
          compareAtPriceMinor: 125_000,
          condition: 'used',
          id: '123e4567-e89b-42d3-a456-426614174002',
          priceMinor: 90_000,
          status: 'active',
          stockQuantity: 2,
        },
      ],
      hasConditionOffers: true,
      variants: [
        {
          available: true,
          compareAtPriceMinor: 120_000,
          id: '123e4567-e89b-42d3-a456-426614174003',
          name: 'Black',
          priceMinor: 95_000,
        },
      ],
    } as const;

    expect(StorefrontPublicProductSchema.parse(value)).toEqual(value);
  });

  it('rejects condition offers without the explicit product capability flag', () => {
    expect(
      StorefrontPublicProductSchema.safeParse({
        ...product,
        conditionOffers: [
          {
            available: true,
            condition: 'used',
            id: '123e4567-e89b-42d3-a456-426614174004',
            priceMinor: 90_000,
            status: 'active',
            stockQuantity: 1,
          },
        ],
      }).success
    ).toBe(false);
  });
});
