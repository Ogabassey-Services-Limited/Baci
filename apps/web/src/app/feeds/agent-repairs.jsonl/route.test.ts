import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockResolveStorefrontMerchantFromRequest = vi.fn();
const mockGetCachedRepairsFeedData = vi.fn();
const mockGenerateAgentRepairsFeed = vi.fn();

vi.mock('@/lib/storefront-merchant', () => ({
  resolveStorefrontMerchantFromRequest: (...args: unknown[]) =>
    mockResolveStorefrontMerchantFromRequest(...args),
}));

vi.mock('@/lib/storefront-repairs/repairs-feed-data', () => ({
  getCachedRepairsFeedData: (...args: unknown[]) =>
    mockGetCachedRepairsFeedData(...args),
}));

vi.mock('@/lib/storefront-repairs/agent-repairs-feed', () => ({
  generateAgentRepairsFeed: (...args: unknown[]) =>
    mockGenerateAgentRepairsFeed(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveStorefrontMerchantFromRequest.mockResolvedValue({
    success: true,
    merchant: {
      id: 'merchant-1',
      slug: 'ogabassey',
      business_name: 'Ogabassey',
      payout_currency: 'NGN',
      logo_url: 'https://cdn.example.com/logo.png',
    },
  });
  mockGetCachedRepairsFeedData.mockResolvedValue({
    items: [{ quoteId: 'quote-1' }],
  });
  mockGenerateAgentRepairsFeed.mockReturnValue(['{"id":"quote-1"}']);
});

describe('GET /feeds/agent-repairs.jsonl', () => {
  it('serves an ndjson repairs feed for a storefront host', async () => {
    const { GET } = await import('./route');

    const response = await GET(
      new NextRequest('https://ogabassey.com/feeds/agent-repairs.jsonl', {
        headers: { host: 'ogabassey.com' },
      })
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain(
      'application/x-ndjson'
    );
    expect(body).toBe('{"id":"quote-1"}');
    expect(mockGetCachedRepairsFeedData).toHaveBeenCalledWith('merchant-1');
    expect(mockGenerateAgentRepairsFeed).toHaveBeenCalledWith(
      [{ quoteId: 'quote-1' }],
      expect.objectContaining({ business_name: 'Ogabassey' }),
      'https://ogabassey.com'
    );
  });

  it('serves an empty body for a merchant with no repair quotes', async () => {
    mockGetCachedRepairsFeedData.mockResolvedValue({ items: [] });
    mockGenerateAgentRepairsFeed.mockReturnValue([]);
    const { GET } = await import('./route');

    const response = await GET(
      new NextRequest('https://ogabassey.com/feeds/agent-repairs.jsonl', {
        headers: { host: 'ogabassey.com' },
      })
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toBe('');
  });

  it('returns the storefront resolution error as JSON', async () => {
    mockResolveStorefrontMerchantFromRequest.mockResolvedValue({
      success: false,
      status: 404,
      error: 'Agent repairs feed is only available on storefront hosts',
    });
    const { GET } = await import('./route');

    const response = await GET(
      new NextRequest('https://usebaci.com/feeds/agent-repairs.jsonl', {
        headers: { host: 'usebaci.com' },
      })
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json).toEqual({
      error: 'Agent repairs feed is only available on storefront hosts',
    });
    expect(mockGetCachedRepairsFeedData).not.toHaveBeenCalled();
  });

  it('returns 500 when feed generation throws', async () => {
    mockGetCachedRepairsFeedData.mockRejectedValue(new Error('db exploded'));
    const { GET } = await import('./route');

    const response = await GET(
      new NextRequest('https://ogabassey.com/feeds/agent-repairs.jsonl', {
        headers: { host: 'ogabassey.com' },
      })
    );
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json).toEqual({ error: 'Failed to generate agent repairs feed' });
  });
});
