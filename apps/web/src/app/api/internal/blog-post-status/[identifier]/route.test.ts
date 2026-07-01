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

  it('returns 400 for invalid route or query parameters', async () => {
    const response = await GET(buildRequest(''), context('bad identifier'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid input',
      code: 'invalid_input',
    });
    expect(getCachedStorefrontBlogPostStatus).not.toHaveBeenCalled();
  });

  it('returns the cached status response with no-store headers', async () => {
    vi.mocked(getCachedStorefrontBlogPostStatus).mockResolvedValueOnce({
      hasError: false,
      present: true,
      redirectPath: '/blog/canonical-post',
    });

    const response = await GET(buildRequest('Retired-Post'), context());

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
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

  it('fails open when cached status resolution throws', async () => {
    vi.mocked(getCachedStorefrontBlogPostStatus).mockRejectedValueOnce(
      new Error('cache unavailable')
    );

    const response = await GET(buildRequest('post'), context());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      hasError: true,
      present: false,
      redirectPath: null,
    });
  });
});
