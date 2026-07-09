import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockResolveFeedMerchant = vi.fn();
const mockGetCachedRepairsFeedData = vi.fn();
const mockGenerateRepairsFacebookFeed = vi.fn();
const mockBuildMerchantBaseUrl = vi.fn();
const mockLoggerError = vi.fn();
const mockCreateAnonClient = vi.fn();

vi.mock('@/lib/feed-identifier', async () => {
  const actual = await vi.importActual<typeof import('@/lib/feed-identifier')>(
    '@/lib/feed-identifier'
  );
  return {
    ...actual,
    resolveFeedMerchant: (...args: unknown[]) =>
      mockResolveFeedMerchant(...args),
  };
});

vi.mock('@/lib/storefront-repairs/repairs-feed-data', () => ({
  getCachedRepairsFeedData: (...args: unknown[]) =>
    mockGetCachedRepairsFeedData(...args),
}));

vi.mock('./feed-builder', () => ({
  generateRepairsFacebookFeed: (...args: unknown[]) =>
    mockGenerateRepairsFacebookFeed(...args),
}));

vi.mock('@/app/api/feed/google-merchant/route-utils', () => ({
  buildMerchantBaseUrl: (...args: unknown[]) =>
    mockBuildMerchantBaseUrl(...args),
}));

vi.mock('@/lib/supabase/anon', () => ({
  createAnonClient: () => mockCreateAnonClient(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: (payload: unknown) => mockLoggerError(payload),
  },
}));

function makeDomainClient(domain: string | null) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = chain;
  builder.eq = chain;
  builder.maybeSingle = () =>
    Promise.resolve({ data: domain ? { domain } : null, error: null });
  return { from: () => builder };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveFeedMerchant.mockResolvedValue({
    id: 'merchant-1',
    business_name: 'Ogabassey',
    country: 'NG',
    logo_url: 'https://cdn.example.com/logo.png',
    payout_currency: 'NGN',
    slug: 'ogabassey',
  });
  mockGetCachedRepairsFeedData.mockResolvedValue({ items: [] });
  mockGenerateRepairsFacebookFeed.mockReturnValue('<rss />');
  mockBuildMerchantBaseUrl.mockReturnValue('https://ogabassey.com');
  mockCreateAnonClient.mockReturnValue(makeDomainClient('ogabassey.com'));
});

describe('generateRepairsFacebookFeedForIdentifier', () => {
  it('resolves the merchant, loads feed data, and returns the built XML', async () => {
    const { generateRepairsFacebookFeedForIdentifier } = await import(
      './feed-service'
    );

    const result = await generateRepairsFacebookFeedForIdentifier({
      identifier: 'ogabassey',
      isBySlug: true,
    });

    expect(result).toEqual({ success: true, xml: '<rss />' });
    expect(mockResolveFeedMerchant).toHaveBeenCalledWith('ogabassey', true);
    expect(mockGetCachedRepairsFeedData).toHaveBeenCalledWith('merchant-1');
    expect(mockBuildMerchantBaseUrl).toHaveBeenCalledWith({
      slug: 'ogabassey',
      custom_domain: 'ogabassey.com',
    });
    expect(mockGenerateRepairsFacebookFeed).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        business_name: 'Ogabassey',
        logo_url: 'https://cdn.example.com/logo.png',
      }),
      'https://ogabassey.com'
    );
  });

  it('returns a 404 when the merchant cannot be resolved', async () => {
    const { MerchantNotFoundError } = await vi.importActual<
      typeof import('@/lib/feed-identifier')
    >('@/lib/feed-identifier');
    mockResolveFeedMerchant.mockRejectedValue(
      new MerchantNotFoundError('missing-slug')
    );

    const { generateRepairsFacebookFeedForIdentifier } = await import(
      './feed-service'
    );
    const result = await generateRepairsFacebookFeedForIdentifier({
      identifier: 'missing-slug',
      isBySlug: true,
    });

    expect(result).toEqual({
      success: false,
      status: 404,
      error: 'Merchant not found',
      cause: expect.any(MerchantNotFoundError),
    });
  });

  it('logs and returns a 500 on unexpected errors', async () => {
    const dbError = new Error('db exploded');
    mockGetCachedRepairsFeedData.mockRejectedValue(dbError);

    const { generateRepairsFacebookFeedForIdentifier } = await import(
      './feed-service'
    );
    const result = await generateRepairsFacebookFeedForIdentifier({
      identifier: 'ogabassey',
      isBySlug: true,
    });

    expect(result).toEqual({
      success: false,
      status: 500,
      error: 'Failed to generate feed',
      cause: dbError,
    });
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Failed to generate Facebook repairs feed',
        error: dbError,
      })
    );
  });
});
