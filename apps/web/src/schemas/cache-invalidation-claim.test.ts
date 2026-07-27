import { describe, expect, it } from 'vitest';
import { cacheInvalidationClaimSchema } from './cache-invalidation-claim';

describe('cacheInvalidationClaimSchema', () => {
  it('accepts a bounded immutable target claim', () => {
    expect(
      cacheInvalidationClaimSchema.safeParse({
        attempts: 1,
        claim_token: '11111111-1111-4111-8111-111111111111',
        generation: 2,
        merchant_id: '22222222-2222-4222-8222-222222222222',
        product_slugs: ['cache-phone'],
        related_identifiers: ['shop-one', 'shop.example.com'],
        target_id: 'shop-one',
        target_kind: 'storefront_slug',
      }).success
    ).toBe(true);
  });

  it('rejects unknown target kinds and malformed claim fences', () => {
    expect(
      cacheInvalidationClaimSchema.safeParse({
        attempts: 0,
        claim_token: 'not-a-uuid',
        generation: 0,
        merchant_id: 'not-a-uuid',
        target_id: '',
        target_kind: 'all_hosts',
      }).success
    ).toBe(false);
  });
});
