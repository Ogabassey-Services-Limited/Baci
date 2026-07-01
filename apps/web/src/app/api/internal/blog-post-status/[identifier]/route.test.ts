import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCachedFeatureSettings, getMerchantSafe } from '@/lib/cached-data';
import { applyPublicBlogSqlFilters } from '@/lib/public-blog-sql-filters';
import { createPublicClient } from '@/lib/supabase/anon';
import { GET } from './route';

vi.mock('@/env', () => ({
  getInternalApiSecret: () => 'test-internal-secret',
}));

vi.mock('@/lib/cached-data', () => ({
  getCachedFeatureSettings: vi.fn().mockResolvedValue({ blog_enabled: true }),
  getMerchantSafe: vi.fn().mockResolvedValue({
    id: 'merchant-1',
    is_published: true,
  }),
}));

vi.mock('@/lib/public-blog-sql-filters', () => ({
  applyPublicBlogSqlFilters: vi.fn((query) => query),
}));

vi.mock('@/lib/supabase/anon', () => ({
  createPublicClient: vi.fn(),
}));

type QueryResponse = { data: unknown; error: unknown };

function createQuery(response: QueryResponse) {
  return {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(response),
    neq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
  };
}

function mockSupabaseResponses(responses: QueryResponse[]) {
  const queries = responses.map(createQuery);
  const pendingQueries = [...queries];
  vi.mocked(createPublicClient).mockReturnValue({
    from: vi.fn(() => {
      const query = pendingQueries.shift();
      if (!query) {
        throw new Error('Unexpected Supabase query');
      }
      return query;
    }),
  } as unknown as ReturnType<typeof createPublicClient>);
  return queries;
}

function buildRequest(slug = 'requested-post', auth = 'test-internal-secret') {
  const request = new NextRequest(
    `https://usebaci.com/api/internal/blog-post-status/ogabassey?slug=${slug}`
  );
  request.headers.set('Authorization', `Bearer ${auth}`);
  return request;
}

function context(identifier = 'ogabassey') {
  return { params: Promise.resolve({ identifier }) };
}

describe('GET /api/internal/blog-post-status/[identifier]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMerchantSafe).mockResolvedValue({
      id: 'merchant-1',
      is_published: true,
    } as Awaited<ReturnType<typeof getMerchantSafe>>);
    vi.mocked(getCachedFeatureSettings).mockResolvedValue({
      blog_enabled: true,
    } as Awaited<ReturnType<typeof getCachedFeatureSettings>>);
  });

  it('rejects unauthenticated requests', async () => {
    const response = await GET(buildRequest('post', 'wrong'), context());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('reports a published post as present', async () => {
    mockSupabaseResponses([
      { data: { id: 'post-1', slug: 'requested-post' }, error: null },
    ]);

    const response = await GET(buildRequest(), context());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      hasError: false,
      present: true,
      redirectPath: null,
    });
  });

  it('reports a missing post as absent when no redirect exists', async () => {
    mockSupabaseResponses([
      { data: null, error: null },
      { data: null, error: null },
    ]);

    const response = await GET(buildRequest(), context());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      hasError: false,
      present: false,
      redirectPath: null,
    });
  });

  it('returns a safe internal redirect path for retired blog slugs', async () => {
    const queries = mockSupabaseResponses([
      { data: null, error: null },
      { data: { target_post_id: 'post-2' }, error: null },
      { data: { slug: 'canonical-post' }, error: null },
    ]);

    const response = await GET(buildRequest('retired-post'), context());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      hasError: false,
      present: true,
      redirectPath: '/blog/canonical-post',
    });
    expect(applyPublicBlogSqlFilters).toHaveBeenCalledTimes(2);
    expect(queries[2].not).toHaveBeenCalledWith('title', 'is', null);
    expect(queries[2].not).toHaveBeenCalledWith('slug', 'is', null);
    expect(queries[2].neq).toHaveBeenCalledWith('title', '');
    expect(queries[2].neq).toHaveBeenCalledWith('slug', '');
  });

  it('does not redirect retired slugs to the same post slug', async () => {
    mockSupabaseResponses([
      { data: null, error: null },
      { data: { target_post_id: 'post-2' }, error: null },
      { data: { slug: 'retired-post' }, error: null },
    ]);

    const response = await GET(buildRequest('retired-post'), context());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      hasError: false,
      present: false,
      redirectPath: null,
    });
  });

  it('fails open for unpublished stores and query errors', async () => {
    vi.mocked(getMerchantSafe).mockResolvedValueOnce({
      id: 'merchant-1',
      is_published: false,
    } as Awaited<ReturnType<typeof getMerchantSafe>>);

    const unpublishedResponse = await GET(buildRequest(), context());
    await expect(unpublishedResponse.json()).resolves.toEqual({
      hasError: true,
      present: false,
      redirectPath: null,
    });

    vi.mocked(getMerchantSafe).mockResolvedValueOnce({
      id: 'merchant-1',
      is_published: true,
    } as Awaited<ReturnType<typeof getMerchantSafe>>);
    mockSupabaseResponses([{ data: null, error: { message: 'timeout' } }]);

    const errorResponse = await GET(buildRequest(), context());
    await expect(errorResponse.json()).resolves.toEqual({
      hasError: true,
      present: false,
      redirectPath: null,
    });
  });
});
