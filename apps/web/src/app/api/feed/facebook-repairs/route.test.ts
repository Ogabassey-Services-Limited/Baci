import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGenerateRepairsFacebookFeedForIdentifier = vi.fn();

vi.mock('./feed-service', () => ({
  generateRepairsFacebookFeedForIdentifier: (...args: unknown[]) =>
    mockGenerateRepairsFacebookFeedForIdentifier(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockGenerateRepairsFacebookFeedForIdentifier.mockResolvedValue({
    success: true,
    xml: '<rss />',
  });
});

describe('GET /api/feed/facebook-repairs', () => {
  it('returns 400 when neither merchant_id nor merchant_slug is provided', async () => {
    const { GET } = await import('./route');

    const response = await GET(
      new NextRequest('https://usebaci.com/api/feed/facebook-repairs')
    );

    expect(response.status).toBe(400);
    expect(mockGenerateRepairsFacebookFeedForIdentifier).not.toHaveBeenCalled();
  });

  it('resolves by merchant_slug and returns the XML feed', async () => {
    const { GET } = await import('./route');

    const response = await GET(
      new NextRequest(
        'https://usebaci.com/api/feed/facebook-repairs?merchant_slug=ogabassey'
      )
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

  it('resolves by merchant_id and returns the XML feed', async () => {
    const { GET } = await import('./route');

    const response = await GET(
      new NextRequest(
        'https://usebaci.com/api/feed/facebook-repairs?merchant_id=123e4567-e89b-12d3-a456-426614174000'
      )
    );

    expect(response.status).toBe(200);
    expect(mockGenerateRepairsFacebookFeedForIdentifier).toHaveBeenCalledWith({
      identifier: '123e4567-e89b-12d3-a456-426614174000',
      isBySlug: false,
    });
  });

  it('returns 404 when the merchant is not found', async () => {
    mockGenerateRepairsFacebookFeedForIdentifier.mockResolvedValue({
      success: false,
      status: 404,
      error: 'Merchant not found',
    });
    const { GET } = await import('./route');

    const response = await GET(
      new NextRequest(
        'https://usebaci.com/api/feed/facebook-repairs?merchant_slug=missing'
      )
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json).toEqual({ error: 'Merchant not found' });
  });

  it('returns 500 on unexpected feed generation failures', async () => {
    mockGenerateRepairsFacebookFeedForIdentifier.mockResolvedValue({
      success: false,
      status: 500,
      error: 'Failed to generate feed',
    });
    const { GET } = await import('./route');

    const response = await GET(
      new NextRequest(
        'https://usebaci.com/api/feed/facebook-repairs?merchant_slug=ogabassey'
      )
    );
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json).toEqual({ error: 'Failed to generate feed' });
  });
});
