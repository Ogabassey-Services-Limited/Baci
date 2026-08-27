import { describe, expect, it } from 'vitest';
import { getPersistedLineKey } from './transaction-review-discount-line-key';

describe('getPersistedLineKey', () => {
  it('returns a canonical key for a valid persisted item identity', () => {
    expect(
      getPersistedLineKey({
        condition: 'new',
        product_id: 'product-1',
        variant_attributes: { Color: 'Blue' },
        variant_id: 'variant-1',
      })
    ).toBe('["product-1","variant-1","new",{"Color":"Blue"}]');
  });

  it('rejects malformed persisted item identity fields', () => {
    expect(
      getPersistedLineKey({
        product_id: 'product-1',
        variant_attributes: { Color: 42 as unknown as string },
        variant_id: null,
      })
    ).toBeNull();
  });
});
