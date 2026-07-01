import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCachedStorefrontBlogListingStatus } from '@/lib/cached-storefront-blog-listing-status';
import { GET } from './route';

vi.mock('@/env', () => ({
  getInternalApiSecret: () => 'test-internal-secret',
}));

vi.mock('@/lib/cached-storefront-blog-listing-status', () => ({
  getCachedStorefrontBlogListingStatus: vi.fn(),
}));

function buildRequest(query: string, auth = 'test-internal-secret') {
  const request = new NextRequest(
    `https://usebaci.com/api/internal/blog-listing-status/ogabassey?${query}`
  );
  request.headers.set('Authorization', `Bearer ${auth}`);
  return request;
}

function context(identifier = 'ogabassey') {
  return { params: Promise.resolve({ identifier }) };
}

const NOOP = {
  hasError: false,
  redirectPath: null,
  permanent: false,
  notFound: false,
};

describe('GET /api/internal/blog-listing-status/[identifier]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCachedStorefrontBlogListingStatus).mockResolvedValue(NOOP);
  });

  it('rejects unauthenticated requests before resolving status', async () => {
    const response = await GET(
      buildRequest('kind=category-query&category=Smartphones', 'wrong'),
      context()
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(getCachedStorefrontBlogListingStatus).not.toHaveBeenCalled();
  });

  it('returns 400 for an unknown kind', async () => {
    const response = await GET(buildRequest('kind=bogus'), context());

    expect(response.status).toBe(400);
    expect(getCachedStorefrontBlogListingStatus).not.toHaveBeenCalled();
  });

  it('returns 400 for a category-query missing its category', async () => {
    const response = await GET(buildRequest('kind=category-query'), context());

    expect(response.status).toBe(400);
    expect(getCachedStorefrontBlogListingStatus).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid route identifier', async () => {
    const response = await GET(
      buildRequest('kind=category-query&category=Smartphones'),
      context('   ')
    );

    expect(response.status).toBe(400);
    expect(getCachedStorefrontBlogListingStatus).not.toHaveBeenCalled();
  });

  it('coerces the page param and resolves a listing-page intent', async () => {
    vi.mocked(getCachedStorefrontBlogListingStatus).mockResolvedValueOnce({
      hasError: false,
      redirectPath: '/blog?page=3',
      permanent: false,
      notFound: false,
    });

    const response = await GET(
      buildRequest('kind=listing-page&page=99'),
      context()
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({
      hasError: false,
      redirectPath: '/blog?page=3',
      permanent: false,
      notFound: false,
    });
    expect(getCachedStorefrontBlogListingStatus).toHaveBeenCalledWith(
      'ogabassey',
      { kind: 'listing-page', page: 99 }
    );
  });

  it('defaults author page to 1 and forwards the intent', async () => {
    await GET(buildRequest('kind=author&authorSlug=bassey-john'), context());

    expect(getCachedStorefrontBlogListingStatus).toHaveBeenCalledWith(
      'ogabassey',
      { kind: 'author', authorSlug: 'bassey-john', page: 1 }
    );
  });

  it('fails open with a 200 body when the resolver throws', async () => {
    vi.mocked(getCachedStorefrontBlogListingStatus).mockRejectedValueOnce(
      new Error('boom')
    );

    const response = await GET(
      buildRequest('kind=category-query&category=Smartphones'),
      context()
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      hasError: true,
      redirectPath: null,
      permanent: false,
      notFound: false,
    });
  });
});
