import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCachedStorefrontBlogPostStatus } from '@/lib/cached-storefront-blog-post-status';
import { GET } from './route';

vi.mock('@/env', () => ({
  getInternalApiSecret: () => 'test-internal-secret',
}));

vi.mock('@/lib/cached-storefront-blog-post-status', () => ({
  getCachedStorefrontBlogPostStatus: vi.fn(),
}));

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
    vi.mocked(getCachedStorefrontBlogPostStatus).mockResolvedValue({
      hasError: false,
      present: true,
      redirectPath: null,
    });
  });

  it('rejects unauthenticated requests before resolving cached status', async () => {
    const response = await GET(buildRequest('post', 'wrong'), context());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(getCachedStorefrontBlogPostStatus).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid slug query parameter', async () => {
    const response = await GET(buildRequest(''), context());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid input',
      code: 'invalid_input',
    });
    expect(getCachedStorefrontBlogPostStatus).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid route identifier parameter', async () => {
    const response = await GET(buildRequest('valid-post'), context('   '));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid input',
      code: 'invalid_input',
    });
    expect(getCachedStorefrontBlogPostStatus).not.toHaveBeenCalled();
  });

  it('edge-caches a definitive live-post verdict (present, no redirect)', async () => {
    vi.mocked(getCachedStorefrontBlogPostStatus).mockResolvedValueOnce({
      hasError: false,
      present: true,
      redirectPath: null,
    });

    const response = await GET(buildRequest('live-post'), context());

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe(
      's-maxage=300, stale-while-revalidate=3600'
    );
    // Vary: Authorization keeps a shared cache from replaying this bearer-gated
    // 200 to an unauthenticated caller (RFC 9111 §3.5).
    expect(response.headers.get('Vary')).toBe('Authorization');
    await expect(response.json()).resolves.toEqual({
      hasError: false,
      present: true,
      redirectPath: null,
    });
    expect(getCachedStorefrontBlogPostStatus).toHaveBeenCalledWith(
      'ogabassey',
      'live-post'
    );
  });

  it('does not edge-cache a retired-slug redirect verdict (target/slug can change with no purge path)', async () => {
    vi.mocked(getCachedStorefrontBlogPostStatus).mockResolvedValueOnce({
      hasError: false,
      present: true,
      redirectPath: '/blog/canonical-post',
    });

    const response = await GET(buildRequest('Retired-Post'), context());

    expect(response.status).toBe(200);
    // A cached redirect could go stale for the whole TTL window if the target
    // changes or the retired slug is reused; revalidateTag can't purge this
    // header-based edge entry, so redirect verdicts stay no-store.
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Vary')).toBeNull();
    await expect(response.json()).resolves.toEqual({
      hasError: false,
      present: true,
      redirectPath: '/blog/canonical-post',
    });
    expect(getCachedStorefrontBlogPostStatus).toHaveBeenCalledWith(
      'ogabassey',
      'Retired-Post'
    );
  });

  it('caches a definitive-absent (missing) verdict with no-store so a later-published post is never sticky-404ed', async () => {
    vi.mocked(getCachedStorefrontBlogPostStatus).mockResolvedValueOnce({
      hasError: false,
      present: false,
      redirectPath: null,
    });

    const response = await GET(buildRequest('unpublished-post'), context());

    expect(response.status).toBe(200);
    // A definitively-absent verdict drives the proxy's hard-404; caching it would
    // hard-404 the post for the TTL window if it is published later.
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({
      hasError: false,
      present: false,
      redirectPath: null,
    });
  });

  it('does not edge-cache a fail-open verdict returned without throwing', async () => {
    // The resolver returns hasError:true WITHOUT throwing on a transient
    // merchant-lookup failure or an unpublished store. This must never be sticky.
    vi.mocked(getCachedStorefrontBlogPostStatus).mockResolvedValueOnce({
      hasError: true,
      present: false,
      redirectPath: null,
    });

    const response = await GET(buildRequest('post'), context());

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({
      hasError: true,
      present: false,
      redirectPath: null,
    });
  });

  it('fails open with no-store when cached status resolution throws', async () => {
    vi.mocked(getCachedStorefrontBlogPostStatus).mockRejectedValueOnce(
      new Error('cache unavailable')
    );

    const response = await GET(buildRequest('post'), context());

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({
      hasError: true,
      present: false,
      redirectPath: null,
    });
  });
});
