import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

const mockNot = vi.fn();
const mockSingle = vi.fn();
const mockRange = vi.fn();
const mockQuery = {
  contains: vi.fn(() => mockQuery),
  eq: vi.fn(() => mockQuery),
  from: vi.fn(() => mockQuery),
  not: mockNot,
  order: vi.fn(() => mockQuery),
  range: mockRange,
  rpc: vi.fn(),
  select: vi.fn(() => mockQuery),
  single: mockSingle,
};

mockNot.mockReturnValue(mockQuery);
mockRange.mockResolvedValue({ data: [], error: null, count: 0 });
mockSingle.mockResolvedValue({
  data: {
    id: 'post-1',
    slug: 'discover-ready-post',
    title: 'Discover Ready Post',
  },
  error: null,
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockQuery),
}));

import { GET } from './route';

describe('GET /api/blog/posts', () => {
  const publishedPosts = [
    {
      id: 'post-1',
      slug: 'discover-ready-post',
      title: 'Discover Ready Post',
      published_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'post-2',
      slug: 'discover-ready-follow-up',
      title: 'Discover Ready Follow Up',
      published_at: '2026-01-02T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockNot.mockReturnValue(mockQuery);
    mockRange.mockResolvedValue({
      data: publishedPosts,
      error: null,
      count: publishedPosts.length,
    });
    mockSingle.mockResolvedValue({
      data: {
        id: 'post-1',
        slug: 'discover-ready-post',
        title: 'Discover Ready Post',
      },
      error: null,
    });
  });

  it('excludes platform listing rows without a published_at timestamp', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/blog/posts')
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        posts: publishedPosts,
        total: publishedPosts.length,
      })
    );
    expect(body.posts).toHaveLength(2);
    expect(
      body.posts.every(
        (post: { published_at: string | null }) => post.published_at !== null
      )
    ).toBe(true);
    expect(mockQuery.eq).toHaveBeenCalledWith('status', 'published');
    expect(mockNot).toHaveBeenCalledWith('published_at', 'is', null);
  });

  it('returns 500 when the platform listing query fails', async () => {
    mockRange.mockResolvedValueOnce({
      data: null,
      error: new Error('listing query failed'),
      count: 0,
    });

    const response = await GET(
      new NextRequest('http://localhost/api/blog/posts')
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to fetch blog posts',
    });
    expect(mockQuery.eq).toHaveBeenCalledWith('status', 'published');
    expect(mockNot).toHaveBeenCalledWith('published_at', 'is', null);
  });

  it('excludes platform slug lookups without a published_at timestamp', async () => {
    const response = await GET(
      new NextRequest(
        'http://localhost/api/blog/posts?slug=discover-ready-post'
      )
    );

    expect(response.status).toBe(200);
    expect(mockQuery.eq).toHaveBeenCalledWith('status', 'published');
    expect(mockNot).toHaveBeenCalledWith('published_at', 'is', null);
  });

  it('returns 500 when the platform slug lookup query fails', async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: new Error('slug query failed'),
    });

    const response = await GET(
      new NextRequest(
        'http://localhost/api/blog/posts?slug=discover-ready-post'
      )
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to fetch blog post',
    });
    expect(mockQuery.eq).toHaveBeenCalledWith('status', 'published');
    expect(mockNot).toHaveBeenCalledWith('published_at', 'is', null);
  });
});
