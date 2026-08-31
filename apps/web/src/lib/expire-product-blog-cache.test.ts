import { describe, expect, it, vi } from 'vitest';

const mockRevalidateProducts = vi.fn();
const mockRevalidateTag = vi.fn();

vi.mock('@/lib/product-cache-revalidation', () => ({
  productCacheRevalidation: {
    revalidateProducts: (...args: unknown[]) => mockRevalidateProducts(...args),
  },
}));
vi.mock('next/cache', () => ({
  revalidateTag: (...args: unknown[]) => mockRevalidateTag(...args),
}));

import { expireProductBlogCache } from './expire-product-blog-cache';

describe('expireProductBlogCache', () => {
  it('hard-expires merchant products and shared blog enrichment before edge purge', () => {
    expireProductBlogCache('merchant-1');

    expect(mockRevalidateProducts).toHaveBeenCalledWith(
      'merchant-1',
      undefined,
      { expireImmediately: true, feedScope: 'none' }
    );
    expect(mockRevalidateTag).toHaveBeenCalledWith('blog-posts', { expire: 0 });
  });
});
