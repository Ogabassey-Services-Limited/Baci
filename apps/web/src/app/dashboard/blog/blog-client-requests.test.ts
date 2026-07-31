import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchWithCsrf = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api-client', () => ({ fetchWithCsrf }));

import { blogClientRequests } from './blog-client-requests';

describe('blogClientRequests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds a paginated filtered posts query', () => {
    expect(
      blogClientRequests
        .buildPostsQuery('merchant-1', 'published', 'summer sale', 3)
        .toString()
    ).toBe(
      'merchantId=merchant-1&status=published&search=summer+sale&limit=20&offset=40'
    );
  });

  it('returns posts and counts from a successful listing request', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ hasMore: true, posts: [{ id: 'post-1' }] }),
      ok: true,
    }) as typeof fetch;

    await expect(
      blogClientRequests.requestPosts(new URLSearchParams('limit=20'))
    ).resolves.toEqual({ hasMore: true, posts: [{ id: 'post-1' }] });
  });

  it('uses the server error when listing posts fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ error: 'Read access denied' }),
      ok: false,
      status: 403,
    }) as typeof fetch;

    await expect(
      blogClientRequests.requestPosts(new URLSearchParams())
    ).rejects.toThrow('Read access denied');
  });

  it('uses csrf-protected mutations and rejects failed responses', async () => {
    fetchWithCsrf
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({
        json: async () => ({ status: 'published' }),
        ok: true,
      });

    await blogClientRequests.requestDeletePost('merchant-1', 'post-1');
    await expect(
      blogClientRequests.requestUpdatePostStatus(
        'merchant-1',
        'post-1',
        'draft'
      )
    ).rejects.toThrow('Failed to update post');
    await expect(
      blogClientRequests.requestUpdatePostStatus(
        'merchant-1',
        'post-1',
        'published'
      )
    ).resolves.toEqual({ status: 'published' });

    expect(fetchWithCsrf).toHaveBeenNthCalledWith(
      1,
      '/api/merchant/blog/posts/post-1?merchantId=merchant-1',
      { method: 'DELETE' }
    );
  });
});
