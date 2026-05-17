import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGenerateFacebookCatalogFeedForIdentifier = vi.fn();

vi.mock('@/lib/cache-headers', () => ({
  CACHE_HEADERS: {
    LONG: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  },
}));

vi.mock('./feed-service', () => ({
  generateFacebookCatalogFeedForIdentifier: (...args: unknown[]) =>
    mockGenerateFacebookCatalogFeedForIdentifier(...args),
}));

function makeRequest(path: string) {
  return new NextRequest(`https://example.com${path}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  mockGenerateFacebookCatalogFeedForIdentifier.mockResolvedValue({
    success: true,
    xml: '<rss />',
  });
});

describe('GET /api/feed/facebook', () => {
  it('returns 400 when merchant identifier is missing', async () => {
    const { GET } = await import('./route');

    const response = await GET(makeRequest('/api/feed/facebook'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe(
      'merchant_id or merchant_slug parameter is required'
    );
    expect(mockGenerateFacebookCatalogFeedForIdentifier).not.toHaveBeenCalled();
  });

  it('returns 400 when both merchant identifiers are provided', async () => {
    const { GET } = await import('./route');

    const response = await GET(
      makeRequest(
        '/api/feed/facebook?merchant_id=00000000-0000-4000-8000-000000000001&merchant_slug=ogabassey'
      )
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe(
      'Provide exactly one of merchant_id or merchant_slug, not both'
    );
  });

  it('returns Facebook catalog XML for a valid merchant slug', async () => {
    const { GET } = await import('./route');

    const response = await GET(
      makeRequest('/api/feed/facebook?merchant_slug=ogabassey')
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/xml');
    expect(response.headers.get('cache-control')).toBe(
      'public, s-maxage=3600, stale-while-revalidate=86400'
    );
    expect(body).toBe('<rss />');
    expect(mockGenerateFacebookCatalogFeedForIdentifier).toHaveBeenCalledWith({
      identifier: 'ogabassey',
      isBySlug: true,
    });
  });

  it('returns 404 when merchant is not found', async () => {
    mockGenerateFacebookCatalogFeedForIdentifier.mockResolvedValue({
      success: false,
      status: 404,
      error: 'Merchant not found',
      cause: new Error('missing'),
    });
    const { GET } = await import('./route');

    const response = await GET(
      makeRequest('/api/feed/facebook?merchant_slug=missing')
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Merchant not found');
  });

  it('returns 500 when feed generation fails', async () => {
    mockGenerateFacebookCatalogFeedForIdentifier.mockResolvedValue({
      success: false,
      status: 500,
      error: 'Failed to generate feed',
      cause: new Error('db failed'),
    });
    const { GET } = await import('./route');

    const response = await GET(
      makeRequest('/api/feed/facebook?merchant_slug=ogabassey')
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to generate feed');
  });
});
