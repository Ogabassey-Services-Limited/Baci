import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockResolveFeedMerchant = vi.fn();
const mockGetCachedGoogleMerchantFeedData = vi.fn();
const mockGenerateFacebookCatalogFeed = vi.fn();
const mockLoggerError = vi.fn();

vi.mock('@/lib/feed-identifier', () => {
  class _MerchantNotFoundError extends Error {
    constructor(identifier: string) {
      super(`Merchant not found: ${identifier}`);
      this.name = 'MerchantNotFoundError';
    }
  }

  return {
    MerchantNotFoundError: _MerchantNotFoundError,
    resolveFeedMerchant: (...args: unknown[]) =>
      mockResolveFeedMerchant(...args),
  };
});

vi.mock('../google-merchant/feed-data', () => ({
  getCachedGoogleMerchantFeedData: (...args: unknown[]) =>
    mockGetCachedGoogleMerchantFeedData(...args),
}));

vi.mock('./feed-builder', () => ({
  generateFacebookCatalogFeed: (...args: unknown[]) =>
    mockGenerateFacebookCatalogFeed(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: (payload: unknown) => mockLoggerError(payload),
  },
}));

import { MerchantNotFoundError } from '@/lib/feed-identifier';
import { generateFacebookCatalogFeedForIdentifier } from './feed-service';

beforeEach(() => {
  vi.clearAllMocks();

  mockResolveFeedMerchant.mockResolvedValue({
    id: 'merchant-1',
    business_name: 'Ogabassey',
    country: 'NG',
    payout_currency: 'NGN',
    slug: 'ogabassey',
  });
  mockGetCachedGoogleMerchantFeedData.mockResolvedValue({
    custom_domain: 'ogabassey.com',
    slug: 'ogabassey',
    products: [{ id: 'product-1', name: 'Phone' }],
    imageManifest: {},
  });
  mockGenerateFacebookCatalogFeed.mockReturnValue('<rss />');
});

describe('generateFacebookCatalogFeedForIdentifier', () => {
  it('generates Facebook catalog XML for a resolved merchant slug', async () => {
    const result = await generateFacebookCatalogFeedForIdentifier({
      identifier: 'ogabassey',
      isBySlug: true,
    });

    expect(result).toEqual({ success: true, xml: '<rss />' });
    expect(mockResolveFeedMerchant).toHaveBeenCalledWith('ogabassey', true);
    expect(mockGetCachedGoogleMerchantFeedData).toHaveBeenCalledWith(
      'merchant-1',
      'ogabassey'
    );
    expect(mockGenerateFacebookCatalogFeed).toHaveBeenCalledWith(
      [{ id: 'product-1', name: 'Phone' }],
      expect.objectContaining({
        id: 'merchant-1',
        slug: 'ogabassey',
        custom_domain: 'ogabassey.com',
      }),
      'https://ogabassey.com',
      {}
    );
  });

  it('falls back to the baci.app slug URL when no custom domain exists', async () => {
    mockGetCachedGoogleMerchantFeedData.mockResolvedValue({
      custom_domain: null,
      slug: 'ogabassey',
      products: [{ id: 'product-1', name: 'Phone' }],
      imageManifest: {},
    });
    mockGenerateFacebookCatalogFeed.mockImplementation((...args: unknown[]) => {
      return `<rss><link>${String(args[2])}</link></rss>`;
    });

    const result = await generateFacebookCatalogFeedForIdentifier({
      identifier: 'ogabassey',
      isBySlug: true,
    });

    expect(result).toEqual({
      success: true,
      xml: '<rss><link>https://ogabassey.baci.app</link></rss>',
    });
  });

  it('returns 404 when the merchant cannot be resolved', async () => {
    const error = new MerchantNotFoundError('missing');
    mockResolveFeedMerchant.mockRejectedValue(error);

    const result = await generateFacebookCatalogFeedForIdentifier({
      identifier: 'missing',
      isBySlug: true,
    });

    expect(result).toEqual({
      success: false,
      status: 404,
      error: 'Merchant not found',
      cause: error,
    });
    expect(mockGenerateFacebookCatalogFeed).not.toHaveBeenCalled();
  });

  it('returns 500 and logs when feed data loading fails', async () => {
    const error = new Error('feed data failed');
    mockGetCachedGoogleMerchantFeedData.mockRejectedValue(error);

    const result = await generateFacebookCatalogFeedForIdentifier({
      identifier: 'ogabassey',
      isBySlug: true,
    });

    expect(result).toEqual({
      success: false,
      status: 500,
      error: 'Failed to generate feed',
      cause: error,
    });
    expect(mockLoggerError).toHaveBeenCalledWith({
      message: 'Failed to generate Facebook catalog feed',
      error,
      identifier: 'ogabassey',
      isBySlug: true,
    });
  });
});
