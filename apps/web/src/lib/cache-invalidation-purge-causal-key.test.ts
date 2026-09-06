import { describe, expect, it } from 'vitest';
import { cacheInvalidationPurgeCausalKey } from './cache-invalidation-purge-causal-key';

describe('cacheInvalidationPurgeCausalKey', () => {
  it('keys only on merchant_id and generation', () => {
    expect(
      cacheInvalidationPurgeCausalKey({
        generation: 6,
        merchant_id: '22222222-2222-4222-8222-222222222222',
      })
    ).toBe(
      cacheInvalidationPurgeCausalKey({
        generation: 6,
        merchant_id: '22222222-2222-4222-8222-222222222222',
      })
    );
  });
});
