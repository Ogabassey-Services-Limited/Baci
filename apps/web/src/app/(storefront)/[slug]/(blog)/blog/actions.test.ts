import { beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({})),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => mockQuery),
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
  });

  it('excludes published posts without a published_at timestamp', async () => {
    const expectedPosts = [{ id: 'post-1', slug: 'post-1', title: 'Post 1' }];
    mockQuery.data = expectedPosts as never[];

    const result = await fetchMorePosts('merchant-1', 1);

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

    const result = await fetchMorePosts('merchant-1', 2);

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

    await expect(fetchMorePosts('merchant-1', 1)).rejects.toBe(rangeError);

    expect(consoleError).toHaveBeenCalledWith(
      'Failed to fetch more blog posts',
      expect.objectContaining({
        merchantId: 'merchant-1',
        page: 1,
        error: rangeError,
      })
    );
    consoleError.mockRestore();
  });
});
