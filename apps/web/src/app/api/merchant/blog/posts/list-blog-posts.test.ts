import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createChainableMock,
  makeRequest,
  mockHasPermission,
  mockSupabase,
  setupAuth,
} from './route.test-support';

const { listBlogPosts } = await import('./list-blog-posts');

describe('listBlogPosts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mockSupabase, createChainableMock());
    setupAuth(true, true);
    mockHasPermission.mockReturnValue(true);
  });

  it('returns the selected merchant posts and readiness counts', async () => {
    const mainQuery = {
      eq: vi.fn(),
      order: vi.fn(),
      range: vi.fn().mockResolvedValue({
        count: 2,
        data: [{ id: 'post-1', slug: 'first-post', status: 'published' }],
        error: null,
      }),
      select: vi.fn(),
    };
    mainQuery.select.mockReturnValue(mainQuery);
    mainQuery.eq.mockReturnValue(mainQuery);
    mainQuery.order.mockReturnValue(mainQuery);
    const countQuery = (count: number, withStatus = false) => {
      const query = { eq: vi.fn(), select: vi.fn() };
      query.select.mockReturnValue(query);
      if (withStatus) {
        query.eq
          .mockReturnValueOnce(query)
          .mockResolvedValueOnce({ count, error: null });
      } else {
        query.eq.mockResolvedValueOnce({ count, error: null });
      }
      return query;
    };
    mockSupabase.from
      .mockReturnValueOnce(mainQuery)
      .mockReturnValueOnce(countQuery(2))
      .mockReturnValueOnce(countQuery(1, true))
      .mockReturnValueOnce(countQuery(1, true))
      .mockReturnValueOnce(countQuery(0, true));

    const response = await listBlogPosts(
      makeRequest('/api/merchant/blog/posts?limit=1&offset=0')
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      counts: { archived: 0, draft: 1, published: 1, total: 2 },
      hasMore: true,
      limit: 1,
      offset: 0,
      posts: [{ id: 'post-1', slug: 'first-post', status: 'published' }],
      total: 2,
    });
  });

  it('denies listing when the merchant role lacks marketing view permission', async () => {
    mockHasPermission.mockReturnValue(false);

    const response = await listBlogPosts(
      makeRequest('/api/merchant/blog/posts')
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'Permission denied',
    });
  });
});
