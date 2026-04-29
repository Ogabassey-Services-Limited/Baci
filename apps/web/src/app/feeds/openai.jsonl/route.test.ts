import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockResolveStorefrontMerchantFromRequest = vi.fn();
const mockGetCachedOpenAIFeedData = vi.fn();
const mockGenerateOpenAIFeed = vi.fn();
const mockGenerateCurrentOpenAIProductFeed = vi.fn();
const originalRootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;

vi.mock('@/lib/storefront-merchant', () => ({
  resolveStorefrontMerchantFromRequest: (...args: unknown[]) =>
    mockResolveStorefrontMerchantFromRequest(...args),
}));

vi.mock('@/app/api/feed/openai/feed-data', () => ({
  getCachedOpenAIFeedData: (...args: unknown[]) =>
    mockGetCachedOpenAIFeedData(...args),
}));

vi.mock('@/app/api/feed/openai/legacy-feed-generator', () => ({
  generateOpenAIFeed: (...args: unknown[]) => mockGenerateOpenAIFeed(...args),
}));

vi.mock('@/app/api/feed/openai/current-feed-generator', () => ({
  generateCurrentOpenAIProductFeed: (...args: unknown[]) =>
    mockGenerateCurrentOpenAIProductFeed(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  delete process.env.NEXT_PUBLIC_ROOT_DOMAIN;

  mockResolveStorefrontMerchantFromRequest.mockResolvedValue({
    success: true,
    identifier: 'ogabassey',
    merchant: {
      id: 'merchant-1',
      slug: 'ogabassey',
      business_name: 'Ogabassey',
      payout_currency: 'NGN',
      country: 'NG',
    },
  });
  mockGetCachedOpenAIFeedData.mockResolvedValue({
    products: [{ id: 'product-1', name: 'iPhone 16' }],
  });
  mockGenerateOpenAIFeed.mockReturnValue(['{"id":"product-1"}']);
  mockGenerateCurrentOpenAIProductFeed.mockReturnValue([
    '{"id":"current-product-1"}',
  ]);
});

afterEach(() => {
  if (originalRootDomain === undefined) {
    delete process.env.NEXT_PUBLIC_ROOT_DOMAIN;
    return;
  }

  process.env.NEXT_PUBLIC_ROOT_DOMAIN = originalRootDomain;
});

describe('GET /feeds/openai.jsonl', () => {
  it('returns the legacy OpenAI feed from a storefront host without an API URL', async () => {
    const { GET } = await import('./route');
    const response = await GET(
      new NextRequest('https://ogabassey.com/feeds/openai.jsonl', {
        headers: { host: 'ogabassey.com' },
      })
    );

    await expect(response.text()).resolves.toBe('{"id":"product-1"}');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(
      'application/x-ndjson; charset=utf-8'
    );
    expect(mockResolveStorefrontMerchantFromRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        rootDomain: 'usebaci.com',
        notFoundError:
          'OpenAI product feed is only available on storefront hosts',
      })
    );
    expect(mockGetCachedOpenAIFeedData).toHaveBeenCalledWith('merchant-1');
    expect(mockGenerateOpenAIFeed).toHaveBeenCalledWith(
      [{ id: 'product-1', name: 'iPhone 16' }],
      expect.objectContaining({ id: 'merchant-1', slug: 'ogabassey' }),
      'https://ogabassey.com'
    );
    expect(mockGenerateCurrentOpenAIProductFeed).not.toHaveBeenCalled();
  });

  it('returns storefront resolution errors without loading feed data', async () => {
    mockResolveStorefrontMerchantFromRequest.mockResolvedValue({
      success: false,
      status: 404,
      error: 'OpenAI product feed is only available on storefront hosts',
    });

    const { GET } = await import('./route');
    const response = await GET(
      new NextRequest('https://usebaci.com/feeds/openai.jsonl', {
        headers: { host: 'usebaci.com' },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe(
      'OpenAI product feed is only available on storefront hosts'
    );
    expect(mockGetCachedOpenAIFeedData).not.toHaveBeenCalled();
  });
});
