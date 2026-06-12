import { beforeEach, describe, expect, it, vi } from 'vitest';

const MERCHANT_ID = '0b9f6b1a-3c2d-4e5f-8a7b-9c0d1e2f3a4b';

const mockNot = vi.fn();
const mockRange = vi.fn();
const mockQuery = {
  data: [],
  error: null,
  eq: vi.fn(() => mockQuery),
  neq: vi.fn(() => mockQuery),
  not: mockNot,
  order: vi.fn(() => mockQuery),
  range: mockRange,
  select: vi.fn(() => mockQuery),
  textSearch: vi.fn(() => mockQuery),
};

const mockEnsureActionRateLimit = vi.fn();

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({})),
}));

vi.mock('@/lib/ensure-action-rate-limit', () => ({
  ensureActionRateLimit: (...args: unknown[]) =>
    mockEnsureActionRateLimit(...args),
}));

const mockFrom = vi.fn(() => mockQuery);

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

import { fetchMorePosts } from './actions';

describe('fetchMorePosts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.data = [];
    mockQuery.error = null;
    mockNot.mockReturnValue(mockQuery);
    mockRange.mockReturnValue(mockQuery);
    mockEnsureActionRateLimit.mockResolvedValue(true);
  });

  it('excludes published posts without a published_at timestamp', async () => {
    const expectedPosts = [{ id: 'post-1', slug: 'post-1', title: 'Post 1' }];
    mockQuery.data = expectedPosts as never[];

    const result = await fetchMorePosts(MERCHANT_ID, 1);

    expect(mockQuery.eq).toHaveBeenCalledWith('status', 'published');
    expect(mockNot).toHaveBeenCalledWith('published_at', 'is', null);
    expect(result).toEqual(expectedPosts);
  });

  it('applies public-content filters before paging to keep page offsets aligned', async () => {
    const expectedPosts = [
      {
        id: 'public-1',
        title: 'Public buying guide',
        slug: 'public-buying-guide',
      },
    ];
    mockQuery.data = expectedPosts as never[];

    const result = await fetchMorePosts(MERCHANT_ID, 2);

    expect(mockNot).toHaveBeenCalledWith('title', 'is', null);
    expect(mockNot).toHaveBeenCalledWith('slug', 'is', null);
    expect(mockQuery.neq).toHaveBeenCalledWith('title', '');
    expect(mockQuery.neq).toHaveBeenCalledWith('slug', '');
    expect(mockNot).toHaveBeenCalledWith('title', 'ilike', 'test post%');
    expect(mockNot).toHaveBeenCalledWith(
      'slug',
      'ilike',
      '%agent-integration-working%'
    );
    expect(mockRange).toHaveBeenCalledTimes(1);
    expect(mockRange).toHaveBeenCalledWith(12, 23);
    expect(mockNot.mock.invocationCallOrder[0]).toBeLessThan(
      mockRange.mock.invocationCallOrder[0]
    );
    expect(mockQuery.neq.mock.invocationCallOrder[0]).toBeLessThan(
      mockRange.mock.invocationCallOrder[0]
    );
    expect(result).toEqual(expectedPosts);
  });

  it('surfaces Supabase range errors instead of treating them as empty pages', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const rangeError = { message: 'range failed' };
    mockQuery.error = rangeError as never;

    await expect(fetchMorePosts(MERCHANT_ID, 1)).rejects.toBe(rangeError);

    expect(consoleError).toHaveBeenCalledWith(
      'Failed to fetch more blog posts',
      expect.objectContaining({
        merchantId: MERCHANT_ID,
        page: 1,
        error: rangeError,
      })
    );
    consoleError.mockRestore();
  });

  it('returns an empty page without querying when rate limited', async () => {
    mockEnsureActionRateLimit.mockResolvedValue(false);

    const result = await fetchMorePosts(MERCHANT_ID, 1);

    expect(result).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockEnsureActionRateLimit).toHaveBeenCalledWith(
      'storefront-blog-list',
      { requests: 60, windowMs: 60_000 }
    );
  });

  it('rejects invalid merchant ids before querying', async () => {
    await expect(fetchMorePosts('merchant-1', 1)).rejects.toThrow(
      'Invalid blog post request'
    );

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('rejects out-of-range pages before querying', async () => {
    await expect(fetchMorePosts(MERCHANT_ID, 0)).rejects.toThrow(
      'Invalid blog post request'
    );
    await expect(fetchMorePosts(MERCHANT_ID, 201)).rejects.toThrow(
      'Invalid blog post request'
    );

    expect(mockFrom).not.toHaveBeenCalled();
  });
});
