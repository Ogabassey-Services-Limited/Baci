import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockNot = vi.fn();
const mockRange = vi.fn();
const mockQuery = {
  data: [],
  eq: vi.fn(() => mockQuery),
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

  it('filters junk posts and keeps scanning later ranges for public posts', async () => {
    const junkPosts = Array.from({ length: 12 }, (_, index) => ({
      id: `junk-${index + 1}`,
      title: 'Test Post: Agent Integration Working',
      slug: `test-post-agent-integration-working-${index + 1}`,
    }));
    const publicPost = {
      id: 'public-1',
      title: 'Public buying guide',
      slug: 'public-buying-guide',
    };

    let rangeCallCount = 0;
    mockRange.mockImplementation((_from: number, _to: number) => {
      rangeCallCount += 1;
      mockQuery.data = (
        rangeCallCount === 1 ? junkPosts : [publicPost]
      ) as never[];
      return mockQuery;
    });

    const result = await fetchMorePosts('merchant-1', 2);

    expect(mockRange).toHaveBeenNthCalledWith(1, 12, 23);
    expect(mockRange).toHaveBeenNthCalledWith(2, 24, 35);
    expect(result).toEqual([publicPost]);
  });
});
