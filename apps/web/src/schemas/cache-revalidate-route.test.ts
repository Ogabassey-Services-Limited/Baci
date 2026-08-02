import { describe, expect, it } from 'vitest';
import { cacheRevalidateRequestSchema } from './cache-revalidate-route';

describe('cacheRevalidateRequestSchema', () => {
  it('accepts a product purge with a server-resolved product identifier', () => {
    expect(
      cacheRevalidateRequestSchema.safeParse({
        targets: ['products'],
        products: [{ id: 'product-1' }],
        merchantId: 'merchant-1',
      }).success
    ).toBe(true);
  });

  it('rejects requests without a cache target', () => {
    expect(
      cacheRevalidateRequestSchema.safeParse({ targets: [] }).success
    ).toBe(false);
  });
});
