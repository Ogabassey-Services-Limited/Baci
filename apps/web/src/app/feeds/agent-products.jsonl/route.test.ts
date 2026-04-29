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
  mockGenerateOpenAIFeed.mockReturnValue(['{"id":"legacy-product-1"}']);
  mockGenerateCurrentOpenAIProductFeed.mockReturnValue([
    '{"id":"current-product-1"}',
  ]);
});

afterEach(() => {
  vi.restoreAllMocks();

  if (originalRootDomain === undefined) {
    delete process.env.NEXT_PUBLIC_ROOT_DOMAIN;
    return;
  }

  process.env.NEXT_PUBLIC_ROOT_DOMAIN = originalRootDomain;
});

describe('GET /feeds/agent-products.jsonl', () => {
  it('returns the current agent product feed from a storefront host', async () => {
    const { GET } = await import('./route');
    const response = await GET(
      new NextRequest('https://ogabassey.com/feeds/agent-products.jsonl', {
        headers: { host: 'ogabassey.com' },
      })
    );

    await expect(response.text()).resolves.toBe('{"id":"current-product-1"}');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(
      'application/x-ndjson; charset=utf-8'
    );
    expect(mockGetCachedOpenAIFeedData).toHaveBeenCalledWith('merchant-1');
    expect(mockGenerateCurrentOpenAIProductFeed).toHaveBeenCalledWith(
      [{ id: 'product-1', name: 'iPhone 16' }],
      expect.objectContaining({ id: 'merchant-1', slug: 'ogabassey' }),
      'https://ogabassey.com'
    );
    expect(mockGenerateOpenAIFeed).not.toHaveBeenCalled();
  });

  it('returns feed generation errors with the standard shape', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockGetCachedOpenAIFeedData.mockRejectedValue(new Error('db failed'));

    const { GET } = await import('./route');
    const response = await GET(
      new NextRequest('https://ogabassey.com/feeds/agent-products.jsonl', {
        headers: { host: 'ogabassey.com' },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to generate OpenAI product feed');
  });
});
