import { describe, expect, it, vi } from 'vitest';

const mockRevalidateProducts = vi.fn();

vi.mock('@/lib/product-cache-revalidation', () => ({
  productCacheRevalidation: {
    revalidateProducts: (...args: unknown[]) => mockRevalidateProducts(...args),
  },
}));

import { expireProductBlogCache } from './expire-product-blog-cache';

describe('expireProductBlogCache', () => {
  it('hard-expires merchant products before edge purge without invalidating other merchants', () => {
    expireProductBlogCache('merchant-1');

    expect(mockRevalidateProducts).toHaveBeenCalledWith(
      'merchant-1',
      undefined,
      { expireImmediately: true, feedScope: 'none' }
    );
  });
});
