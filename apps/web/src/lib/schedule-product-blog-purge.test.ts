import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLookup = vi.fn();
const mockSchedule = vi.fn();
const mockExpire = vi.fn();

vi.mock('@/lib/get-published-blog-post-slugs-for-products', () => ({
  getPublishedBlogPostSlugsForProducts: (...args: unknown[]) =>
    mockLookup(...args),
}));
vi.mock('@/lib/storefront-product-purge', () => ({
  scheduleStorefrontProductPurge: (...args: unknown[]) => mockSchedule(...args),
}));
vi.mock('@/lib/expire-product-blog-cache', () => ({
  expireProductBlogCache: (...args: unknown[]) => mockExpire(...args),
}));

import { scheduleProductBlogPurge } from './schedule-product-blog-purge';

const supabase = {} as never;
const entries = [{ slug: 'pixel-11', categorySegment: 'smartphones' }];

describe('scheduleProductBlogPurge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLookup.mockResolvedValue([]);
  });

  it('looks up linked articles and schedules them with category fallbacks', async () => {
    mockLookup.mockResolvedValue(['Pixel-Guide', 'pixel-guide']);

    await scheduleProductBlogPurge({
      supabase,
      merchantId: 'merchant-1',
      merchantSlug: ' store ',
      productIds: ['product-1'],
      entries,
      categorySlugs: ['smartphones', null, ''],
    });

    expect(mockLookup).toHaveBeenCalledWith(
      supabase,
      'merchant-1',
      ['product-1'],
      ['smartphones']
    );
    expect(mockSchedule).toHaveBeenCalledWith('store', entries, {
      blogPostSlugs: ['pixel-guide'],
    });
    expect(mockExpire).toHaveBeenCalledWith('merchant-1');
  });

  it('uses a pre-delete snapshot without querying cascaded relationships', async () => {
    await scheduleProductBlogPurge({
      supabase,
      merchantId: 'merchant-1',
      merchantSlug: 'store',
      productIds: ['product-1'],
      entries,
      blogPostSlugs: ['Guide-A', 'guide-a', ' guide-b '],
    });

    expect(mockLookup).not.toHaveBeenCalled();
    expect(mockSchedule).toHaveBeenCalledWith('store', entries, {
      blogPostSlugs: ['guide-a', 'guide-b'],
    });
  });

  it('is a no-op when the public merchant slug or entries are missing', async () => {
    await scheduleProductBlogPurge({
      supabase,
      merchantId: 'merchant-1',
      merchantSlug: ' ',
      productIds: ['product-1'],
      entries,
    });
    await scheduleProductBlogPurge({
      supabase,
      merchantId: 'merchant-1',
      merchantSlug: 'store',
      productIds: ['product-1'],
      entries: [],
    });

    expect(mockLookup).not.toHaveBeenCalled();
    expect(mockSchedule).not.toHaveBeenCalled();
    expect(mockExpire).not.toHaveBeenCalled();
  });

  it('can resolve linked posts after an immediate product purge without duplicating an empty purge', async () => {
    await scheduleProductBlogPurge({
      supabase,
      merchantId: 'merchant-1',
      merchantSlug: 'store',
      productIds: ['product-1'],
      entries,
      skipWhenNoLinkedPosts: true,
    });

    expect(mockExpire).toHaveBeenCalledWith('merchant-1');
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('swallows lookup failures so product mutations remain successful', async () => {
    mockLookup.mockRejectedValue(new Error('temporary read failure'));

    await expect(
      scheduleProductBlogPurge({
        supabase,
        merchantId: 'merchant-1',
        merchantSlug: 'store',
        productIds: ['product-1'],
        entries,
      })
    ).resolves.toBeUndefined();

    expect(mockSchedule).not.toHaveBeenCalled();
  });
});
