import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getBlogCacheTag } from '@/lib/blog-cache-tags';
import { getCachedStorefrontBlogPostStatus } from '@/lib/cached-storefront-blog-post-status';
import { GET } from './route';

vi.mock('@/env', () => ({
  getInternalApiSecret: () => 'test-internal-secret',
}));

vi.mock('@/lib/cached-storefront-blog-post-status', () => ({
  getCachedStorefrontBlogPostStatus: vi.fn(),
}));

type AuthMode = 'authorization' | 'custom' | 'none';

function buildRequest(
  slug = 'requested-post',
  auth = 'test-internal-secret',
  authMode: AuthMode = 'authorization'
) {
  const request = new NextRequest(
    `https://usebaci.com/api/internal/blog-post-status/ogabassey?slug=${slug}`
  );
  if (authMode === 'authorization') {
    request.headers.set('Authorization', `Bearer ${auth}`);
  } else if (authMode === 'custom') {
    request.headers.set('x-baci-internal-auth', auth);
  }
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

  it('rejects a wrong bearer secret with 401 no-store before resolving cached status', async () => {
    const response = await GET(buildRequest('post', 'wrong'), context());

    expect(response.status).toBe(401);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(getCachedStorefrontBlogPostStatus).not.toHaveBeenCalled();
  });

  it('rejects a request with no auth header with 401 no-store', async () => {
    const response = await GET(buildRequest('post', '', 'none'), context());

    expect(response.status).toBe(401);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(getCachedStorefrontBlogPostStatus).not.toHaveBeenCalled();
  });

  it('rejects a wrong custom-header secret with 401 no-store', async () => {
    const response = await GET(
      buildRequest('post', 'wrong', 'custom'),
      context()
    );

    expect(response.status).toBe(401);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
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

  it('edge-caches a definitive live-post verdict (present, no redirect) with the purgeable cache tag', async () => {
    vi.mocked(getCachedStorefrontBlogPostStatus).mockResolvedValueOnce({
      hasError: false,
      present: true,
      redirectPath: null,
    });

    // The cache-eligible path is the custom header (what the proxy sends);
    // the legacy Bearer path is covered by the no-store regression below.
    const response = await GET(
      buildRequest('live-post', 'test-internal-secret', 'custom'),
      context()
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe(
      's-maxage=300, stale-while-revalidate=3600'
    );
    // Vary keys the edge entry to the (single) internal secret value, so an
    // unauthenticated request never hits a cached 200. It varies on the custom
    // header (NOT Authorization — that would make the response uncacheable).
    expect(response.headers.get('Vary')).toBe('x-baci-internal-auth');
    // The cache tag is the SAME tag revalidateBlogPosts invalidates for this
    // post, so any mutation purges this CDN entry via revalidateTag.
    expect(response.headers.get('Vercel-Cache-Tag')).toBe(
      getBlogCacheTag('ogabassey', 'live-post')
    );
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

  it('accepts legacy Bearer auth but keeps even the live-post verdict no-store', async () => {
    vi.mocked(getCachedStorefrontBlogPostStatus).mockResolvedValueOnce({
      hasError: false,
      present: true,
      redirectPath: null,
    });

    const response = await GET(buildRequest('live-post'), context());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      hasError: false,
      present: true,
      redirectPath: null,
    });
    // RFC 9111 lets a shared cache store an Authorization-request response
    // when s-maxage is present, so the legacy path must never emit cacheable
    // headers — the entry would be keyed with the custom header absent, the
    // same Vary key an unauthenticated request hits.
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Vercel-Cache-Tag')).toBeNull();
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
    expect(response.headers.get('Vercel-Cache-Tag')).toBeNull();
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
