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
  beforeEach(() => {
    vi.clearAllMocks();
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
  });

  it('excludes platform listing rows without a published_at timestamp', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/blog/posts')
    );

    expect(response.status).toBe(200);
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
});
