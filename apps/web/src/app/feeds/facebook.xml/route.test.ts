import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockResolveStorefrontMerchantFromRequest = vi.fn();
const mockGenerateFacebookCatalogFeedForIdentifier = vi.fn();
const mockLoggerError = vi.fn();

vi.mock('@/lib/storefront-merchant', () => ({
  resolveStorefrontMerchantFromRequest: (...args: unknown[]) =>
    mockResolveStorefrontMerchantFromRequest(...args),
}));

vi.mock('@/app/api/feed/facebook/feed-service', () => ({
  generateFacebookCatalogFeedForIdentifier: (...args: unknown[]) =>
    mockGenerateFacebookCatalogFeedForIdentifier(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: (payload: unknown) => mockLoggerError(payload),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();

  mockResolveStorefrontMerchantFromRequest.mockResolvedValue({
    success: true,
    merchant: {
      id: 'merchant-1',
      slug: 'ogabassey',
      business_name: 'Ogabassey',
      custom_domain: 'ogabassey.com',
    },
  });
  mockGenerateFacebookCatalogFeedForIdentifier.mockResolvedValue({
    success: true,
    xml: '<rss />',
  });
});

describe('GET /feeds/facebook.xml', () => {
  it('serves the Facebook catalog feed through a storefront-scoped public URL', async () => {
    const { GET } = await import('./route');

    const response = await GET(
      new NextRequest('https://ogabassey.com/feeds/facebook.xml', {
        headers: { host: 'ogabassey.com' },
      })
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/xml');
    expect(body).toBe('<rss />');
    expect(mockResolveStorefrontMerchantFromRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.any(Request),
        rootDomain: expect.any(String),
      })
    );
    expect(mockGenerateFacebookCatalogFeedForIdentifier).toHaveBeenCalledWith({
      identifier: 'ogabassey',
      isBySlug: true,
    });
  });

  it('returns the storefront resolution error without querying feed data', async () => {
    mockResolveStorefrontMerchantFromRequest.mockResolvedValue({
      success: false,
      status: 404,
      error: 'Facebook catalog feed is only available on storefront hosts',
    });
    const { GET } = await import('./route');

    const response = await GET(
      new NextRequest('https://usebaci.com/feeds/facebook.xml', {
        headers: { host: 'usebaci.com' },
      })
    );
    const body = await response.text();

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/xml');
    expect(body).toContain(
      '<message>Facebook catalog feed is only available on storefront hosts</message>'
    );
    expect(mockGenerateFacebookCatalogFeedForIdentifier).not.toHaveBeenCalled();
  });

  it('logs and returns XML when storefront lookup fails', async () => {
    const cause = new Error('lookup failed');
    mockResolveStorefrontMerchantFromRequest.mockResolvedValue({
      success: false,
      status: 500,
      error: 'Failed to resolve storefront for Facebook catalog feed',
      cause,
    });
    const { GET } = await import('./route');

    const response = await GET(
      new NextRequest('https://ogabassey.com/feeds/facebook.xml', {
        headers: { host: 'ogabassey.com' },
      })
    );
    const body = await response.text();

    expect(response.status).toBe(500);
    expect(response.headers.get('content-type')).toContain('application/xml');
    expect(body).toContain(
      '<message>Failed to resolve storefront for Facebook catalog feed</message>'
    );
    expect(mockLoggerError).toHaveBeenCalledWith({
      message: 'FACEBOOK_CATALOG_PUBLIC_FEED_ERROR',
      error: cause,
    });
  });

  it('returns feed generation errors as XML', async () => {
    mockGenerateFacebookCatalogFeedForIdentifier.mockResolvedValue({
      success: false,
      status: 500,
      error: 'Failed to generate feed',
      cause: new Error('feed failed'),
    });
    const { GET } = await import('./route');

    const response = await GET(
      new NextRequest('https://ogabassey.com/feeds/facebook.xml', {
        headers: { host: 'ogabassey.com' },
      })
    );
    const body = await response.text();

    expect(response.status).toBe(500);
    expect(response.headers.get('content-type')).toContain('application/xml');
    expect(body).toContain('<message>Failed to generate feed</message>');
  });
});
