import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockResolveStorefrontSitemapContext = vi.fn();
const mockGetNamedSitemapEntries = vi.fn();
const mockCreateSitemapResponse = vi.fn();

vi.mock('../../sitemap-data', () => ({
  resolveStorefrontSitemapContext: (...args: unknown[]) =>
    mockResolveStorefrontSitemapContext(...args),
  getNamedSitemapEntries: (...args: unknown[]) =>
    mockGetNamedSitemapEntries(...args),
  createSitemapResponse: (...args: unknown[]) =>
    mockCreateSitemapResponse(...args),
}));

describe('GET /[slug]/sitemap/[id].xml', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateSitemapResponse.mockImplementation(
      (entries: unknown[]) =>
        new Response(JSON.stringify(entries), {
          headers: { 'content-type': 'application/xml; charset=utf-8' },
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
      'ogabassey'
    );
    expect(mockGetNamedSitemapEntries).toHaveBeenCalledWith(
      { merchant: { id: 'm1' } },
      'categories'
    );
    expect(body).toContain('https://ogabassey.com/smartphones');
  });

  it('returns an empty sitemap response when the storefront is unresolved', async () => {
    mockResolveStorefrontSitemapContext.mockResolvedValue(null);

    const { GET } = await import('./route');
    const response = await GET(
      new Request('https://ogabassey.com/ogabassey/sitemap/static.xml'),
      { params: Promise.resolve({ slug: 'ogabassey', id: 'static' }) }
    );
    const body = await response.text();

    expect(mockGetNamedSitemapEntries).not.toHaveBeenCalled();
    expect(body).toBe('[]');
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
});
