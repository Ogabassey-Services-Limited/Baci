import { beforeEach, describe, expect, it, vi } from 'vitest';

const routeHeadersState = vi.hoisted(() => ({
  current: new Headers(),
}));

const mockResolveStorefrontSitemapContext = vi.fn();
const mockGetNamedSitemapEntries = vi.fn();
const mockGetRootSitemapEntries = vi.fn();
const mockCreateSitemapResponse = vi.fn();
const mockCreateSitemapUnavailableResponse = vi.fn();

vi.mock('next/headers', () => ({
  headers: () => Promise.resolve(routeHeadersState.current),
}));

vi.mock('../../sitemap-data', () => ({
  resolveStorefrontSitemapContext: (...args: unknown[]) =>
    mockResolveStorefrontSitemapContext(...args),
  getNamedSitemapEntries: (...args: unknown[]) =>
    mockGetNamedSitemapEntries(...args),
  getRootSitemapEntries: (...args: unknown[]) =>
    mockGetRootSitemapEntries(...args),
  createSitemapResponse: (...args: unknown[]) =>
    mockCreateSitemapResponse(...args),
  createSitemapUnavailableResponse: (...args: unknown[]) =>
    mockCreateSitemapUnavailableResponse(...args),
}));

describe('GET /[slug]/sitemap/[id].xml', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeHeadersState.current = new Headers();
    mockCreateSitemapResponse.mockImplementation(
      (entries: unknown[]) =>
        new Response(JSON.stringify(entries), {
          headers: { 'content-type': 'application/xml; charset=utf-8' },
        })
    );
    mockCreateSitemapUnavailableResponse.mockImplementation(
      () =>
        new Response('Service Unavailable', {
          status: 503,
          headers: {
            'content-type': 'application/xml; charset=utf-8',
            'cache-control': 'no-store',
            'retry-after': '300',
          },
        })
    );
  });

  it('returns a named storefront sitemap response', async () => {
    mockResolveStorefrontSitemapContext.mockResolvedValue({
      merchant: { id: 'm1' },
    });
    mockGetNamedSitemapEntries.mockResolvedValue([
      { url: 'https://ogabassey.com/smartphones' },
    ]);

    const { GET } = await import('./route');
    const response = await GET(
      new Request('https://ogabassey.com/ogabassey/sitemap/categories.xml'),
      { params: Promise.resolve({ slug: 'ogabassey', id: 'categories' }) }
    );
    const body = await response.text();

    expect(mockResolveStorefrontSitemapContext).toHaveBeenCalledWith(
      expect.any(Headers),
      'ogabassey',
      expect.any(Request)
    );
    expect(mockGetNamedSitemapEntries).toHaveBeenCalledWith(
      { merchant: { id: 'm1' } },
      'categories'
    );
    expect(body).toContain('https://ogabassey.com/smartphones');
  });

  it('uses request-scoped headers for custom-domain sitemap rewrites', async () => {
    routeHeadersState.current = new Headers([
      ['x-merchant-domain', 'ogabassey.com'],
    ]);
    mockResolveStorefrontSitemapContext.mockResolvedValue({
      merchant: { id: 'm1' },
    });
    mockGetNamedSitemapEntries.mockResolvedValue([
      { url: 'https://ogabassey.com/laptops' },
    ]);

    const { GET } = await import('./route');
    await GET(
      new Request('https://ogabassey.com/ogabassey/sitemap/categories.xml'),
      { params: Promise.resolve({ slug: 'ogabassey', id: 'categories' }) }
    );

    expect(mockResolveStorefrontSitemapContext).toHaveBeenCalledWith(
      routeHeadersState.current,
      'ogabassey',
      expect.any(Request)
    );
  });

  it('normalizes .xml suffixes from live route params', async () => {
    mockResolveStorefrontSitemapContext.mockResolvedValue({
      merchant: { id: 'm1' },
    });
    mockGetNamedSitemapEntries.mockResolvedValue([
      { url: 'https://ogabassey.com/smartphones/iphone-17-pro' },
    ]);

    const { GET } = await import('./route');
    await GET(
      new Request('https://ogabassey.com/ogabassey/sitemap/products.xml'),
      { params: Promise.resolve({ slug: 'ogabassey', id: 'products.xml' }) }
    );

    expect(mockGetNamedSitemapEntries).toHaveBeenCalledWith(
      { merchant: { id: 'm1' } },
      'products'
    );
  });

  it('returns the combined root storefront sitemap for root.xml rewrites', async () => {
    mockResolveStorefrontSitemapContext.mockResolvedValue({
      merchant: { id: 'm1' },
    });
    mockGetNamedSitemapEntries.mockResolvedValue([
      { url: 'https://ogabassey.com' },
      { url: 'https://ogabassey.com/smartphones/iphone-17-pro' },
    ]);

    const { GET } = await import('./route');
    const response = await GET(
      new Request('https://ogabassey.com/ogabassey/sitemap/root.xml'),
      { params: Promise.resolve({ slug: 'ogabassey', id: 'root.xml' }) }
    );
    const body = await response.text();

    expect(mockGetNamedSitemapEntries).toHaveBeenCalledWith(
      { merchant: { id: 'm1' } },
      'root'
    );
    expect(mockGetRootSitemapEntries).not.toHaveBeenCalled();
    expect(body).toContain('https://ogabassey.com/smartphones/iphone-17-pro');
  });

  it('returns a 503 response when the storefront is unresolved', async () => {
    mockResolveStorefrontSitemapContext.mockResolvedValue(null);
    const mockUnavailableResponse = new Response('Service Unavailable', {
      status: 503,
      headers: {
        'cache-control': 'no-store',
        'retry-after': '300',
      },
    });
    mockCreateSitemapUnavailableResponse.mockReturnValue(
      mockUnavailableResponse
    );

    const { GET } = await import('./route');
    const request = new Request(
      'https://ogabassey.com/ogabassey/sitemap/static.xml'
    );
    const response = await GET(request, {
      params: Promise.resolve({ slug: 'ogabassey', id: 'static' }),
    });

    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('retry-after')).toBe('300');
  });

  it('passes the Request object as the third argument to resolveStorefrontSitemapContext', async () => {
    mockResolveStorefrontSitemapContext.mockResolvedValue({
      merchant: { id: 'm1' },
    });
    mockGetNamedSitemapEntries.mockResolvedValue([]);

    const { GET } = await import('./route');
    const request = new Request(
      'https://ogabassey.com/ogabassey/sitemap/static.xml'
    );
    await GET(request, {
      params: Promise.resolve({ slug: 'ogabassey', id: 'static' }),
    });

    expect(mockResolveStorefrontSitemapContext).toHaveBeenCalledWith(
      expect.any(Headers),
      'ogabassey',
      request
    );
  });
});
