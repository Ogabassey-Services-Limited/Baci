import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockResolveStorefrontMerchantFromRequest = vi.fn();
const mockGenerateRepairsFacebookFeedForIdentifier = vi.fn();
const mockLoggerError = vi.fn();

vi.mock('@/lib/storefront-merchant', () => ({
  resolveStorefrontMerchantFromRequest: (...args: unknown[]) =>
    mockResolveStorefrontMerchantFromRequest(...args),
}));

vi.mock('@/app/api/feed/facebook-repairs/feed-service', () => ({
  generateRepairsFacebookFeedForIdentifier: (...args: unknown[]) =>
    mockGenerateRepairsFacebookFeedForIdentifier(...args),
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
  mockGenerateRepairsFacebookFeedForIdentifier.mockResolvedValue({
    success: true,
    xml: '<rss />',
  });
});

describe('GET /feeds/facebook-repairs.xml', () => {
  it('serves the repairs catalog feed through a storefront-scoped public URL', async () => {
    const { GET } = await import('./route');

    const response = await GET(
      new NextRequest('https://ogabassey.com/feeds/facebook-repairs.xml', {
        headers: { host: 'ogabassey.com' },
      })
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/xml');
    expect(body).toBe('<rss />');
    expect(mockGenerateRepairsFacebookFeedForIdentifier).toHaveBeenCalledWith({
      identifier: 'ogabassey',
      isBySlug: true,
    });
  });

  it('returns the storefront resolution error without querying feed data', async () => {
    mockResolveStorefrontMerchantFromRequest.mockResolvedValue({
      success: false,
      status: 404,
      error: 'Facebook repairs feed is only available on storefront hosts',
    });
    const { GET } = await import('./route');

    const response = await GET(
      new NextRequest('https://usebaci.com/feeds/facebook-repairs.xml', {
        headers: { host: 'usebaci.com' },
      })
    );
    const body = await response.text();

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/xml');
    expect(body).toContain(
      '<message>Facebook repairs feed is only available on storefront hosts</message>'
    );
    expect(mockGenerateRepairsFacebookFeedForIdentifier).not.toHaveBeenCalled();
  });

  it('logs and returns XML when storefront lookup fails', async () => {
    const cause = new Error('lookup failed');
    mockResolveStorefrontMerchantFromRequest.mockResolvedValue({
      success: false,
      status: 500,
      error: 'Failed to resolve storefront for Facebook repairs feed',
      cause,
    });
    const { GET } = await import('./route');

    const response = await GET(
      new NextRequest('https://ogabassey.com/feeds/facebook-repairs.xml', {
        headers: { host: 'ogabassey.com' },
      })
    );
    const body = await response.text();

    expect(response.status).toBe(500);
    expect(body).toContain(
      '<message>Failed to resolve storefront for Facebook repairs feed</message>'
    );
    expect(mockLoggerError).toHaveBeenCalledWith({
      message: 'FACEBOOK_REPAIRS_PUBLIC_FEED_ERROR',
      error: cause,
    });
  });

  it('returns feed generation errors as XML', async () => {
    mockGenerateRepairsFacebookFeedForIdentifier.mockResolvedValue({
      success: false,
      status: 500,
      error: 'Failed to generate feed',
      cause: new Error('feed failed'),
    });
    const { GET } = await import('./route');

    const response = await GET(
      new NextRequest('https://ogabassey.com/feeds/facebook-repairs.xml', {
        headers: { host: 'ogabassey.com' },
      })
    );
    const body = await response.text();

    expect(response.status).toBe(500);
    expect(body).toContain('<message>Failed to generate feed</message>');
  });
});
