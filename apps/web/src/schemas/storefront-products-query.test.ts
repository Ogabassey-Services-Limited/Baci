import { describe, expect, it } from 'vitest';
import {
  storefrontConditionFilterSchema,
  storefrontProductsQuerySchema,
} from '@/schemas/storefront-products-query';

describe('storefrontConditionFilterSchema', () => {
  it('normalizes legacy condition aliases to canonical values', () => {
    const refurbished =
      storefrontConditionFilterSchema.safeParse('refurbished');
    const ukUsed = storefrontConditionFilterSchema.safeParse('uk_used');

    expect(refurbished.success).toBe(true);
    expect(ukUsed.success).toBe(true);

    if (refurbished.success) {
      expect(refurbished.data).toBe('open_box');
    }

    if (ukUsed.success) {
      expect(ukUsed.data).toBe('used');
    }
  });

  it('rejects unsupported conditions', () => {
    expect(
      storefrontConditionFilterSchema.safeParse('not-a-condition').success
    ).toBe(false);
  });
});

describe('storefrontProductsQuerySchema', () => {
  it('accepts a valid storefront products query', () => {
    const result = storefrontProductsQuerySchema.safeParse({
      merchant_id: '00000000-0000-0000-0000-000000000001',
      category: 'smart-tvs',
      brand: 'Sony',
      condition: 'refurbished',
      min_price: '1000',
      max_price: '9000',
      sort: 'price-asc',
      q: 'bravia',
      has_images: 'true',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.condition).toBe('open_box');
      expect(result.data.min_price).toBe(1000);
      expect(result.data.max_price).toBe(9000);
      expect(result.data.has_images).toBe(true);
    }
  });

  it('rejects invalid merchant ids and invalid condition values', () => {
    expect(
      storefrontProductsQuerySchema.safeParse({
        merchant_id: 'not-a-uuid',
      }).success
    ).toBe(false);
    expect(
      storefrontProductsQuerySchema.safeParse({
        merchant_id: '00000000-0000-0000-0000-000000000001',
        condition: 'broken',
      }).success
    ).toBe(false);
  });
});
