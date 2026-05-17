import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetPlatformBlogListing = vi.fn();
const mockGetPlatformBlogPost = vi.fn();

vi.mock('@/lib/platform-blog', () => ({
  getPlatformBlogListing: (...args: unknown[]) =>
    mockGetPlatformBlogListing(...args),
  getPlatformBlogPost: (...args: unknown[]) => mockGetPlatformBlogPost(...args),
}));

import { GET } from './route';

describe('GET /api/blog/posts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlatformBlogListing.mockResolvedValue({
      hasMore: false,
      limit: 20,
      page: 1,
      posts: [],
      total: 0,
      totalPages: 1,
    });
    mockGetPlatformBlogPost.mockResolvedValue(null);
  });

  it('uses the shared platform listing helper with safe pagination', async () => {
    mockGetPlatformBlogListing.mockResolvedValueOnce({
      hasMore: true,
      limit: 10,
      page: 3,
      posts: [{ id: 'post-1', slug: 'launch-faster', title: 'Launch Faster' }],
      total: 40,
      totalPages: 4,
    });

    const response = await GET(
      new NextRequest('http://localhost/api/blog/posts?limit=10&offset=20')
    );

    expect(response.status).toBe(200);
    expect(mockGetPlatformBlogListing).toHaveBeenCalledWith({
      limit: 10,
      offset: 20,
    });
    await expect(response.json()).resolves.toEqual({
      hasMore: true,
      limit: 10,
      offset: 20,
      page: 3,
      posts: [{ id: 'post-1', slug: 'launch-faster', title: 'Launch Faster' }],
      total: 40,
      totalPages: 4,
    });
  });

  it('honors non-page-aligned offsets exactly', async () => {
    mockGetPlatformBlogListing.mockResolvedValueOnce({
      hasMore: true,
      limit: 10,
      page: 2,
      posts: [{ id: 'post-15', slug: 'exact-offset', title: 'Exact Offset' }],
      total: 40,
      totalPages: 4,
    });

    const response = await GET(
      new NextRequest('http://localhost/api/blog/posts?limit=10&offset=15')
    );

    expect(response.status).toBe(200);
    expect(mockGetPlatformBlogListing).toHaveBeenCalledWith({
      limit: 10,
      offset: 15,
    });
    await expect(response.json()).resolves.toMatchObject({
      offset: 15,
      page: 2,
      posts: [{ id: 'post-15', slug: 'exact-offset', title: 'Exact Offset' }],
    });
  });

  it('returns a single post when slug is provided', async () => {
    mockGetPlatformBlogPost.mockResolvedValueOnce({
      id: 'post-1',
      slug: 'launch-faster',
      title: 'Launch Faster',
    });

    const response = await GET(
      new NextRequest('http://localhost/api/blog/posts?slug=launch-faster')
    );

    expect(response.status).toBe(200);
    expect(mockGetPlatformBlogPost).toHaveBeenCalledWith('launch-faster');
    await expect(response.json()).resolves.toEqual({
      id: 'post-1',
      slug: 'launch-faster',
      title: 'Launch Faster',
    });
  });

  it('returns 404 for missing slug lookups', async () => {
    mockGetPlatformBlogPost.mockResolvedValueOnce(null);

    const response = await GET(
      new NextRequest('http://localhost/api/blog/posts?slug=missing')
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Post not found' });
  });

  it('returns 500 when platform listing fetch fails', async () => {
    mockGetPlatformBlogListing.mockRejectedValueOnce(new Error('db failed'));

    const response = await GET(
      new NextRequest('http://localhost/api/blog/posts')
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to fetch blog posts',
    });
  });
});
