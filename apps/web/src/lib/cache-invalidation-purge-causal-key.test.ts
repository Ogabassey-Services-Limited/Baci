import { describe, expect, it } from 'vitest';
import { cacheInvalidationPurgeCausalKey } from './cache-invalidation-purge-causal-key';

const merchant = '22222222-2222-4222-8222-222222222222';

describe('cacheInvalidationPurgeCausalKey', () => {
  it('coalesces slug and hostname rows that share merchant generation', () => {
    expect(
      cacheInvalidationPurgeCausalKey({
        generation: 6,
        merchant_id: merchant,
        target_id: 'shop-one',
        target_kind: 'storefront_slug',
      })
    ).toBe(
      cacheInvalidationPurgeCausalKey({
        generation: 6,
        merchant_id: merchant,
        target_id: 'shop.example.com',
        target_kind: 'storefront_hostname',
      })
    );
  });

  it('keeps same-generation product claims on distinct target ids separate', () => {
    expect(
      cacheInvalidationPurgeCausalKey({
        generation: 1,
        merchant_id: merchant,
        target_id: '11111111-1111-4111-8111-111111111111',
        target_kind: 'storefront_product',
      })
    ).not.toBe(
      cacheInvalidationPurgeCausalKey({
        generation: 1,
        merchant_id: merchant,
        target_id: '11111111-1111-4111-8111-111111111112',
        target_kind: 'storefront_product',
      })
    );
  });
});
