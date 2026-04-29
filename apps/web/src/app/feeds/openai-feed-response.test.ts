import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPublicOpenAIFeedResponse } from '@/app/feeds/openai-feed-response';

const mockResolveStorefrontMerchantFromRequest = vi.fn();
const mockGetCachedOpenAIFeedData = vi.fn();
const mockGenerateOpenAIFeed = vi.fn();
const mockGenerateCurrentOpenAIProductFeed = vi.fn();

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

describe('createPublicOpenAIFeedResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks();

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

  it('selects the legacy OpenAI generator for the legacy public feed', async () => {
    const response = await createPublicOpenAIFeedResponse(
      new NextRequest('https://ogabassey.com/feeds/openai.jsonl', {
        headers: { host: 'ogabassey.com' },
      }),
      'legacy'
    );

    await expect(response.text()).resolves.toBe('{"id":"legacy-product-1"}');
    expect(mockGenerateOpenAIFeed).toHaveBeenCalledOnce();
    expect(mockGenerateCurrentOpenAIProductFeed).not.toHaveBeenCalled();
  });

  it('selects the current OpenAI generator for the current agent feed', async () => {
    const response = await createPublicOpenAIFeedResponse(
      new NextRequest('https://ogabassey.com/feeds/agent-products.jsonl', {
        headers: { host: 'ogabassey.com' },
      }),
      'current'
    );

    await expect(response.text()).resolves.toBe('{"id":"current-product-1"}');
    expect(mockGenerateCurrentOpenAIProductFeed).toHaveBeenCalledOnce();
    expect(mockGenerateOpenAIFeed).not.toHaveBeenCalled();
  });
});
