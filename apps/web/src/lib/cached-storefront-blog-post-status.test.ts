import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetCachedFeatureSettings = vi.fn();
const mockGetMerchantSafe = vi.fn();
const mockApplyPublicBlogSqlFilters = vi.fn((query: unknown) => query);
const mockCreatePublicClient = vi.fn();

vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

vi.mock('@/lib/cached-data', () => ({
  getCachedFeatureSettings: (...args: unknown[]) =>
    mockGetCachedFeatureSettings(...args),
  getMerchantSafe: (...args: unknown[]) => mockGetMerchantSafe(...args),
}));

vi.mock('@/lib/public-blog-sql-filters', () => ({
  applyPublicBlogSqlFilters: (query: unknown) =>
    mockApplyPublicBlogSqlFilters(query),
}));

vi.mock('@/lib/supabase/anon', () => ({
  createPublicClient: (...args: unknown[]) => mockCreatePublicClient(...args),
}));

import { cacheLife, cacheTag } from 'next/cache';
import { getBlogCacheTag } from '@/lib/blog-cache-tags';
import { getCachedStorefrontBlogPostStatus } from './cached-storefront-blog-post-status';

function createQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn().mockResolvedValue(result),
    neq: vi.fn(() => builder),
    not: vi.fn(() => builder),
    select: vi.fn(() => builder),
  };

  return builder;
}

function mockSupabaseResponses(
  responses: Array<{ data: unknown; error: unknown }>
) {
  const builders = responses.map(createQueryBuilder);
  const pendingBuilders = [...builders];
  const from = vi.fn(() => {
    const builder = pendingBuilders.shift();
    if (!builder) {
      throw new Error('Unexpected Supabase query');
    }
    return builder;
  });
  mockCreatePublicClient.mockReturnValue({ from });
  return { builders, from };
}

describe('getCachedStorefrontBlogPostStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMerchantSafe.mockResolvedValue({
      id: 'merchant-1',
      is_published: true,
    });
    mockGetCachedFeatureSettings.mockResolvedValue({ blog_enabled: true });
  });

  it('fails open for blank inputs before querying', async () => {
    await expect(
      getCachedStorefrontBlogPostStatus('  ', 'post')
    ).resolves.toEqual({
      hasError: true,
      present: false,
      redirectPath: null,
    });
    await expect(
      getCachedStorefrontBlogPostStatus('ogabassey', '  ')
    ).resolves.toEqual({
      hasError: true,
      present: false,
      redirectPath: null,
    });

    expect(mockGetMerchantSafe).not.toHaveBeenCalled();
    expect(mockCreatePublicClient).not.toHaveBeenCalled();
  });

  it('reports a published post as present and tags the lookup cache', async () => {
    const { builders } = mockSupabaseResponses([
      { data: { id: 'post-1', slug: 'requested-post' }, error: null },
    ]);

    await expect(
      getCachedStorefrontBlogPostStatus('Ogabassey.com', ' Requested-Post ')
    ).resolves.toEqual({
      hasError: false,
      present: true,
      redirectPath: null,
    });

    expect(cacheLife).toHaveBeenCalledWith('blog');
    expect(cacheTag).toHaveBeenCalledWith(
      'blog-posts',
      getBlogCacheTag('ogabassey.com', 'requested-post')
    );
    expect(mockGetMerchantSafe).toHaveBeenCalledWith('ogabassey.com');
    expect(builders[0].eq).toHaveBeenCalledWith('slug', 'requested-post');
    expect(mockApplyPublicBlogSqlFilters).toHaveBeenCalledTimes(1);
  });

  it('reports a missing post as absent when no redirect exists', async () => {
    mockSupabaseResponses([
      { data: null, error: null },
      { data: null, error: null },
    ]);

    await expect(
      getCachedStorefrontBlogPostStatus('ogabassey', 'missing-post')
    ).resolves.toEqual({
      hasError: false,
      present: false,
      redirectPath: null,
    });
  });

  it('returns a safe internal redirect path for retired blog slugs', async () => {
    const { builders } = mockSupabaseResponses([
      { data: null, error: null },
      { data: { target_post_id: 'post-2' }, error: null },
      { data: { slug: 'canonical-post' }, error: null },
    ]);

    await expect(
      getCachedStorefrontBlogPostStatus('ogabassey', 'retired-post')
    ).resolves.toEqual({
      hasError: false,
      present: true,
      redirectPath: '/blog/canonical-post',
    });

    expect(mockApplyPublicBlogSqlFilters).toHaveBeenCalledTimes(2);
    expect(builders[2].not).toHaveBeenCalledWith('title', 'is', null);
    expect(builders[2].not).toHaveBeenCalledWith('slug', 'is', null);
    expect(builders[2].neq).toHaveBeenCalledWith('title', '');
    expect(builders[2].neq).toHaveBeenCalledWith('slug', '');
  });

  it('does not redirect retired slugs to the same post slug', async () => {
    mockSupabaseResponses([
      { data: null, error: null },
      { data: { target_post_id: 'post-2' }, error: null },
      { data: { slug: 'retired-post' }, error: null },
    ]);

    await expect(
      getCachedStorefrontBlogPostStatus('ogabassey', 'retired-post')
    ).resolves.toEqual({
      hasError: false,
      present: false,
      redirectPath: null,
    });
  });

  it('fails open without querying posts for unpublished stores', async () => {
    mockGetMerchantSafe.mockResolvedValueOnce({
      id: 'merchant-1',
      is_published: false,
    });

    await expect(
      getCachedStorefrontBlogPostStatus('ogabassey', 'post')
    ).resolves.toEqual({
      hasError: true,
      present: false,
      redirectPath: null,
    });
    expect(mockCreatePublicClient).not.toHaveBeenCalled();
  });

  it('reports missing when the merchant blog feature is disabled', async () => {
    mockGetCachedFeatureSettings.mockResolvedValueOnce({ blog_enabled: false });

    await expect(
      getCachedStorefrontBlogPostStatus('ogabassey', 'post')
    ).resolves.toEqual({
      hasError: false,
      present: false,
      redirectPath: null,
    });
    expect(mockCreatePublicClient).not.toHaveBeenCalled();
  });

  it('throws initial post query errors so callers fail open without caching the outage', async () => {
    mockSupabaseResponses([
      { data: null, error: new Error('blog lookup failed') },
    ]);

    await expect(
      getCachedStorefrontBlogPostStatus('ogabassey', 'post')
    ).rejects.toThrow('blog lookup failed');
  });

  it('throws redirect lookup errors so callers fail open', async () => {
    mockSupabaseResponses([
      { data: null, error: null },
      { data: null, error: new Error('redirect lookup failed') },
    ]);

    await expect(
      getCachedStorefrontBlogPostStatus('ogabassey', 'retired-post')
    ).rejects.toThrow('redirect lookup failed');
  });

  it('throws target post lookup errors so callers fail open', async () => {
    mockSupabaseResponses([
      { data: null, error: null },
      { data: { target_post_id: 'post-2' }, error: null },
      { data: null, error: new Error('target lookup failed') },
    ]);

    await expect(
      getCachedStorefrontBlogPostStatus('ogabassey', 'retired-post')
    ).rejects.toThrow('target lookup failed');
  });
});
