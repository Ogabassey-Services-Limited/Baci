import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockResolveStorefrontMerchantFromRequest = vi.fn();
const mockGoogleMerchantFeedGET = vi.fn();

vi.mock('@/lib/storefront-merchant', () => ({
  resolveStorefrontMerchantFromRequest: (...args: unknown[]) =>
    mockResolveStorefrontMerchantFromRequest(...args),
}));

vi.mock('@/app/api/feed/google-merchant/route', () => ({
  GET: (...args: unknown[]) => mockGoogleMerchantFeedGET(...args),
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

  mockGoogleMerchantFeedGET.mockResolvedValue(
    new NextResponse('<rss />', {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
      },
    })
  );
});

describe('GET /feeds/google-merchant.xml', () => {
  it('serves the Google Merchant feed through a storefront-scoped public URL', async () => {
    const { GET } = await import('./route');

    const response = await GET(
      new NextRequest('https://ogabassey.com/feeds/google-merchant.xml', {
        headers: { host: 'ogabassey.com' },
      })
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toBe('<rss />');
    expect(mockResolveStorefrontMerchantFromRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.any(Request),
        rootDomain: expect.any(String),
      })
    );
    expect(mockGoogleMerchantFeedGET).toHaveBeenCalledTimes(1);

    const delegatedCall = mockGoogleMerchantFeedGET.mock.calls[0];
    expect(delegatedCall).toBeDefined();
    const delegatedRequest = delegatedCall?.[0] as NextRequest;
    expect(delegatedRequest.nextUrl.pathname).toBe('/api/feed/google-merchant');
    expect(delegatedRequest.nextUrl.searchParams.get('merchant_slug')).toBe(
      'ogabassey'
    );
    expect(delegatedRequest.headers.get('host')).toBe('ogabassey.com');
  });

  it('returns the storefront resolution error without querying feed data', async () => {
    mockResolveStorefrontMerchantFromRequest.mockResolvedValue({
      success: false,
      status: 404,
      error: 'Google Merchant feed is only available on storefront hosts',
    });
    const { GET } = await import('./route');

    const response = await GET(
      new NextRequest('https://usebaci.com/feeds/google-merchant.xml', {
        headers: { host: 'usebaci.com' },
      })
    );
    const body = await response.text();

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/xml');
    expect(body).toContain(
      '<message>Google Merchant feed is only available on storefront hosts</message>'
    );
    expect(mockGoogleMerchantFeedGET).not.toHaveBeenCalled();
  });

  it('returns invalid-host storefront resolution errors without querying feed data', async () => {
    mockResolveStorefrontMerchantFromRequest.mockResolvedValue({
      success: false,
      status: 400,
      error: 'Invalid storefront host',
    });
    const { GET } = await import('./route');

    const response = await GET(
      new NextRequest('https://usebaci.com/feeds/google-merchant.xml', {
        headers: { host: '<script>' },
      })
    );
    const body = await response.text();

    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toContain('application/xml');
    expect(body).toContain('<message>Invalid storefront host</message>');
    expect(mockGoogleMerchantFeedGET).not.toHaveBeenCalled();
  });

  it('logs and returns the storefront resolution error when lookup fails', async () => {
    const cause = new Error('lookup failed');
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockResolveStorefrontMerchantFromRequest.mockResolvedValue({
      success: false,
      status: 500,
      error: 'Failed to resolve storefront for Google Merchant feed',
      cause,
    });
    const { GET } = await import('./route');

    try {
      const response = await GET(
        new NextRequest('https://ogabassey.com/feeds/google-merchant.xml', {
          headers: { host: 'ogabassey.com' },
        })
      );
      const body = await response.text();

      expect(response.status).toBe(500);
      expect(response.headers.get('content-type')).toContain('application/xml');
      expect(body).toContain(
        '<message>Failed to resolve storefront for Google Merchant feed</message>'
      );
      expect(errorSpy).toHaveBeenCalledWith(
        'GOOGLE_MERCHANT_PUBLIC_FEED_ERROR:',
        cause
      );
      expect(mockGoogleMerchantFeedGET).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });
});
