import { describe, expect, it } from 'vitest';
import { cacheInvalidationDrainCronResponseSchemas } from './cache-invalidation-drain-cron';

const claim = {
  attempts: 1,
  claim_token: '11111111-1111-4111-8111-111111111111',
  generation: 2,
  merchant_id: '22222222-2222-4222-8222-222222222222',
  product_slugs: ['cache-phone'],
  related_identifiers: ['shop-one', 'shop.example.com'],
  target_id: 'shop-one',
  target_kind: 'storefront_slug',
};

describe('cacheInvalidationDrainCronResponseSchemas', () => {
  it('accepts at most one cron claim batch', () => {
    expect(
      cacheInvalidationDrainCronResponseSchemas.claims.safeParse([
        claim,
        { ...claim, target_id: 'shop-two' },
      ]).success
    ).toBe(true);
    expect(
      cacheInvalidationDrainCronResponseSchemas.claims.safeParse([
        claim,
        { ...claim, target_id: 'shop-two' },
        { ...claim, target_id: 'shop-three' },
      ]).success
    ).toBe(false);
  });

  it('accepts only a boolean dead-letter alert state', () => {
    expect(
      cacheInvalidationDrainCronResponseSchemas.deadLetters.safeParse(true)
        .success
    ).toBe(true);
    expect(
      cacheInvalidationDrainCronResponseSchemas.deadLetters.safeParse('true')
        .success
    ).toBe(false);
  });
});
