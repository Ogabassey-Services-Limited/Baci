import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BLOG_LISTING_PAGE_SIZE } from '@/lib/blog-listing-page-size';

const mockCacheLife = vi.fn();
const mockCacheTag = vi.fn();
const mockCreatePublicClient = vi.fn();
const mockMaybeSingle = vi.fn();
const mockRange = vi.fn();
const mockLimit = vi.fn();
const mockFrom = vi.fn();
const mockRpc = vi.fn();

const mockQuery = {
  contains: vi.fn(() => mockQuery),
  eq: vi.fn(() => mockQuery),
  is: vi.fn(() => mockQuery),
  limit: (...args: unknown[]) => mockLimit(...args),
  maybeSingle: (...args: unknown[]) => mockMaybeSingle(...args),
  not: vi.fn(() => mockQuery),
  order: vi.fn(() => mockQuery),
  range: (...args: unknown[]) => mockRange(...args),
  select: vi.fn(() => mockQuery),
};

vi.mock('next/cache', () => ({
  cacheLife: (...args: unknown[]) => mockCacheLife(...args),
  cacheTag: (...args: unknown[]) => mockCacheTag(...args),
}));

vi.mock('@/lib/supabase/public', () => ({
  createPublicClient: (...args: unknown[]) => mockCreatePublicClient(...args),
}));

import {
  getPlatformBlogFeedPosts,
  getPlatformBlogListCacheTag,
  getPlatformBlogListing,
  getPlatformBlogPost,
  getPlatformBlogPostCacheTag,
  getPlatformBlogSitemapPosts,
  getScopedPlatformBlogListCacheTag,
  incrementPlatformBlogPostViews,
  PLATFORM_BLOG_CACHE_TAG,
  PLATFORM_BLOG_FEED_CACHE_TAG,
  PLATFORM_BLOG_LIST_CACHE_TAG,
  PLATFORM_BLOG_SELECT,
  PLATFORM_BLOG_SITEMAP_CACHE_TAG,
} from './platform-blog';

describe('platform-blog query helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue(mockQuery);
    mockCreatePublicClient.mockReturnValue({
      from: mockFrom,
      rpc: (...args: unknown[]) => mockRpc(...args),
    });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockRange.mockResolvedValue({ data: [], error: null, count: 0 });
    mockLimit.mockResolvedValue({ data: [], error: null });
    mockRpc.mockResolvedValue({ data: null, error: null });
  });

  it('reads a published platform post with persistent post cache tags', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        id: 'post-1',
        slug: 'platform-launch',
        title: 'Platform Launch',
      },
      error: null,
    });

    const result = await getPlatformBlogPost('platform-launch');

    expect(result).toEqual(
      expect.objectContaining({
        slug: 'platform-launch',
        title: 'Platform Launch',
      })
    );
    expect(mockCreatePublicClient).toHaveBeenCalledWith({
      clientInfo: 'baci-web-platform-blog',
      timeoutMs: 4000,
    });
    expect(mockFrom).toHaveBeenCalledWith('blog_posts');
    expect(mockQuery.select).toHaveBeenCalledWith(PLATFORM_BLOG_SELECT);
    expect(mockQuery.eq).toHaveBeenCalledWith('is_platform_post', true);
    expect(mockQuery.is).toHaveBeenCalledWith('merchant_id', null);
    expect(mockQuery.eq).toHaveBeenCalledWith('status', 'published');
    expect(mockQuery.not).toHaveBeenCalledWith('published_at', 'is', null);
    expect(mockQuery.eq).toHaveBeenCalledWith('slug', 'platform-launch');
    expect(mockCacheLife).toHaveBeenCalledWith('merchant');
    expect(mockCacheTag).toHaveBeenCalledWith(
      PLATFORM_BLOG_CACHE_TAG,
      getPlatformBlogPostCacheTag('platform-launch')
    );
  });

  it('throws when platform post lookup errors', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'query failed' },
    });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(
      // biome-ignore lint/suspicious/noEmptyBlockStatements: suppress console.error noise in test
      () => {}
    );

    await expect(getPlatformBlogPost('missing-post')).rejects.toEqual({
      message: 'query failed',
    });
    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to load platform blog post',
      expect.objectContaining({
        error: { message: 'query failed' },
        slug: 'missing-post',
      })
    );
    consoleSpy.mockRestore();
  });

  it('returns null without querying when slug is missing at runtime', async () => {
    const result = await getPlatformBlogPost(undefined as unknown as string);

    expect(result).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('lists platform posts with pagination and list cache tags', async () => {
    mockRange.mockResolvedValueOnce({
      data: [
        {
          id: 'post-1',
          slug: 'platform-launch',
          title: 'Platform Launch',
        },
      ],
      error: null,
      count: 1,
    });

    const result = await getPlatformBlogListing();

    expect(result).toEqual({
      hasMore: false,
      limit: BLOG_LISTING_PAGE_SIZE,
      page: 1,
      posts: [
        {
          id: 'post-1',
          slug: 'platform-launch',
          title: 'Platform Launch',
        },
      ],
      total: 1,
      totalPages: 1,
    });
    expect(mockQuery.eq).toHaveBeenCalledWith('is_platform_post', true);
    expect(mockQuery.is).toHaveBeenCalledWith('merchant_id', null);
    expect(mockQuery.eq).toHaveBeenCalledWith('status', 'published');
    expect(mockQuery.not).toHaveBeenCalledWith('published_at', 'is', null);
    expect(mockRange).toHaveBeenCalledWith(0, BLOG_LISTING_PAGE_SIZE - 1);
    expect(mockCacheLife).toHaveBeenCalledWith('merchant');
    expect(mockCacheTag).toHaveBeenCalledWith(
      PLATFORM_BLOG_CACHE_TAG,
      PLATFORM_BLOG_LIST_CACHE_TAG,
      getPlatformBlogListCacheTag(1)
    );
  });

  it('uses exact offsets for platform listing ranges', async () => {
    mockRange.mockResolvedValueOnce({
      data: [],
      error: null,
      count: 40,
    });

    const result = await getPlatformBlogListing({ limit: 10, offset: 15 });

    expect(result).toMatchObject({
      hasMore: true,
      limit: 10,
      page: 2,
      total: 40,
      totalPages: 4,
    });
    expect(mockRange).toHaveBeenCalledWith(15, 24);
    expect(mockCacheTag).toHaveBeenCalledWith(
      PLATFORM_BLOG_CACHE_TAG,
      PLATFORM_BLOG_LIST_CACHE_TAG,
      getPlatformBlogListCacheTag(2)
    );
  });

  it('applies category/tag filters and scoped cache tags for filtered listings', async () => {
    mockRange.mockResolvedValueOnce({
      data: [],
      error: null,
      count: 0,
    });

    await getPlatformBlogListing({
      category: 'insights',
      limit: 10,
      offset: 0,
      tag: 'payments',
    });

    expect(mockQuery.eq).toHaveBeenCalledWith('category', 'insights');
    expect(mockQuery.contains).toHaveBeenCalledWith('tags', ['payments']);
    expect(mockCacheTag).toHaveBeenCalledWith(
      PLATFORM_BLOG_CACHE_TAG,
      PLATFORM_BLOG_LIST_CACHE_TAG,
      getScopedPlatformBlogListCacheTag({
        category: 'insights',
        page: 1,
        tag: 'payments',
      })
    );
  });

  it('caps feed reads at 50 published platform posts', async () => {
    mockLimit.mockResolvedValueOnce({
      data: [{ slug: 'platform-launch' }],
      error: null,
    });

    const result = await getPlatformBlogFeedPosts();

    expect(result).toEqual([{ slug: 'platform-launch' }]);
    expect(mockQuery.eq).toHaveBeenCalledWith('is_platform_post', true);
    expect(mockQuery.is).toHaveBeenCalledWith('merchant_id', null);
    expect(mockQuery.eq).toHaveBeenCalledWith('status', 'published');
    expect(mockQuery.not).toHaveBeenCalledWith('published_at', 'is', null);
    expect(mockLimit).toHaveBeenCalledWith(50);
    expect(mockCacheTag).toHaveBeenCalledWith(
      PLATFORM_BLOG_CACHE_TAG,
      PLATFORM_BLOG_FEED_CACHE_TAG
    );
  });

  it('fetches lean sitemap fields with sitemap cache tags', async () => {
    mockLimit.mockResolvedValueOnce({
      data: [
        {
          slug: 'platform-launch',
          published_at: '2026-05-16T00:00:00.000Z',
          updated_at: null,
        },
      ],
      error: null,
    });

    const result = await getPlatformBlogSitemapPosts();

    expect(result).toEqual([
      {
        slug: 'platform-launch',
        published_at: '2026-05-16T00:00:00.000Z',
        updated_at: null,
      },
    ]);
    expect(mockQuery.select).toHaveBeenCalledWith(
      'slug, published_at, updated_at'
    );
    expect(mockQuery.eq).toHaveBeenCalledWith('is_platform_post', true);
    expect(mockQuery.is).toHaveBeenCalledWith('merchant_id', null);
    expect(mockQuery.eq).toHaveBeenCalledWith('status', 'published');
    expect(mockQuery.not).toHaveBeenCalledWith('published_at', 'is', null);
    expect(mockCacheTag).toHaveBeenCalledWith(
      PLATFORM_BLOG_CACHE_TAG,
      PLATFORM_BLOG_SITEMAP_CACHE_TAG
    );
  });

  it('increments platform post view counts through the public RPC', async () => {
    await incrementPlatformBlogPostViews('  post-1  ');

    expect(mockRpc).toHaveBeenCalledWith('increment_blog_post_views', {
      p_post_id: 'post-1',
    });
  });

  it('re-throws RPC errors when view increment fails', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'rpc failed' },
    });

    await expect(incrementPlatformBlogPostViews('post-1')).rejects.toEqual(
      expect.objectContaining({
        message: 'rpc failed',
      })
    );
  });
});
