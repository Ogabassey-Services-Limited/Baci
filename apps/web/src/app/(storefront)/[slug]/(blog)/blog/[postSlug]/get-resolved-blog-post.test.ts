import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetRequestScopedBlogPost = vi.fn();
const mockGetLiveBlogPost = vi.fn();

vi.mock('@/lib/cached-data', () => ({
  getRequestScopedBlogPost: (...args: unknown[]) =>
    mockGetRequestScopedBlogPost(...args),
}));

vi.mock('@/lib/live-blog-post', () => ({
  getLiveBlogPost: (...args: unknown[]) => mockGetLiveBlogPost(...args),
}));

import { getResolvedBlogPost } from './get-resolved-blog-post';

describe('getResolvedBlogPost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns cached data before falling back to the live query', async () => {
    const cachedPost = { post: { slug: 'cached-post' } };
    mockGetRequestScopedBlogPost.mockResolvedValue(cachedPost);

    const result = await getResolvedBlogPost(
      'ogabassey.com',
      'cached-post',
      false
    );

    expect(mockGetRequestScopedBlogPost).toHaveBeenCalledWith(
      'ogabassey.com',
      'cached-post',
      false
    );
    expect(result).toBe(cachedPost);
    expect(mockGetLiveBlogPost).not.toHaveBeenCalled();
  });

  it('falls back to the live query when the cached lookup misses', async () => {
    const livePost = { post: { slug: 'live-post' } };
    mockGetRequestScopedBlogPost.mockResolvedValue(null);
    mockGetLiveBlogPost.mockResolvedValue(livePost);

    const result = await getResolvedBlogPost(
      'ogabassey.com',
      'live-post',
      true
    );

    expect(mockGetLiveBlogPost).toHaveBeenCalledWith(
      'ogabassey.com',
      'live-post',
      true
    );
    expect(result).toBe(livePost);
  });

  it('logs cache failures before falling back to the live query', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const livePost = { post: { slug: 'live-post' } };

    mockGetRequestScopedBlogPost.mockRejectedValue(
      new Error('Cache lookup failed')
    );
    mockGetLiveBlogPost.mockResolvedValue(livePost);

    const result = await getResolvedBlogPost(
      'ogabassey.com',
      'live-post',
      false
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error fetching cached blog post, falling back to live query',
      expect.objectContaining({
        slug: 'ogabassey.com',
        postSlug: 'live-post',
        error: expect.any(Error),
      })
    );
    expect(result).toBe(livePost);

    consoleErrorSpy.mockRestore();
  });
});
