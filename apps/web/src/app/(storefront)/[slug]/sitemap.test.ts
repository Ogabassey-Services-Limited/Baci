import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockHeaders = vi.fn();
const mockResolveStorefrontSitemapContext = vi.fn();
const mockGetRootSitemapEntries = vi.fn();
const mockBuildMerchantTrustProfile = vi.fn();

vi.mock('next/headers', () => ({
  headers: () => mockHeaders(),
}));

vi.mock('./sitemap-data', () => ({
  resolveStorefrontSitemapContext: (...args: unknown[]) =>
    mockResolveStorefrontSitemapContext(...args),
  getRootSitemapEntries: (...args: unknown[]) =>
    mockGetRootSitemapEntries(...args),
}));

vi.mock('@/lib/storefront-trust/build-merchant-trust-profile', () => ({
  buildMerchantTrustProfile: (...args: unknown[]) =>
    mockBuildMerchantTrustProfile(...args),
}));

describe('storefront sitemap root', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHeaders.mockResolvedValue(
      new Headers([['x-custom-domain', 'ogabassey.com']])
    );
  });

  it('returns trust policy URLs from the root sitemap path', async () => {
    mockResolveStorefrontSitemapContext.mockResolvedValue({
      merchant: {
        id: 'm1',
        slug: 'ogabassey',
        trust_profile: {
          return_policy: { summary: 'Returns', window_days: 7 },
          shipping_policy: { summary: 'Shipping', regions: ['Nigeria'] },
          warranty_policy: { summary: 'Warranty' },
        },
      },
      storeUrl: 'https://ogabassey.com',
    });
    mockGetRootSitemapEntries.mockResolvedValue([
      { url: 'https://ogabassey.com' },
    ]);
    mockBuildMerchantTrustProfile.mockReturnValue({
      returnPolicy: {
        summary: 'Returns',
        windowDays: 7,
        localRoute: '/returns',
      },
      shippingPolicy: {
        summary: 'Shipping',
        regions: ['Nigeria'],
        localRoute: '/shipping',
      },
      warrantyPolicy: {
        summary: 'Warranty',
        localRoute: '/warranty',
      },
      socialLinks: {},
    });

    const { default: sitemap } = await import('./sitemap');
    const result = await sitemap();

    expect(result).toEqual([
      { url: 'https://ogabassey.com' },
      expect.objectContaining({
        url: 'https://ogabassey.com/returns',
        changeFrequency: 'monthly',
        priority: 0.5,
      }),
      expect.objectContaining({
        url: 'https://ogabassey.com/shipping',
        changeFrequency: 'monthly',
        priority: 0.5,
      }),
      expect.objectContaining({
        url: 'https://ogabassey.com/warranty',
        changeFrequency: 'monthly',
        priority: 0.5,
      }),
    ]);
  });

  it('returns an empty sitemap when the storefront cannot be resolved', async () => {
    mockResolveStorefrontSitemapContext.mockResolvedValue(null);

    const { default: sitemap } = await import('./sitemap');
    const result = await sitemap();

    expect(mockGetRootSitemapEntries).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('omits returns and shipping URLs for partial-only trust data', async () => {
    mockResolveStorefrontSitemapContext.mockResolvedValue({
      merchant: {
        id: 'm1',
        slug: 'ogabassey',
        trust_profile: {
          return_policy: { return_method: 'mail', return_fees: 'free' },
          shipping_policy: {
            handling_days_min: 0,
            transit_days_min: 1,
            shipping_fee_type: 'calculated',
          },
          warranty_policy: { summary: 'Warranty' },
        },
      },
      storeUrl: 'https://ogabassey.com',
    });
    mockGetRootSitemapEntries.mockResolvedValue([
      { url: 'https://ogabassey.com' },
    ]);
    mockBuildMerchantTrustProfile.mockReturnValue({
      returnPolicy: {
        localRoute: '/returns',
      },
      shippingPolicy: {
        handlingDaysMin: 0,
        transitDaysMin: 1,
        shippingFeeType: 'calculated',
        localRoute: '/shipping',
      },
      warrantyPolicy: {
        summary: 'Warranty',
        localRoute: '/warranty',
      },
      socialLinks: {},
      derivedLinks: {},
    });

    const { default: sitemap } = await import('./sitemap');
    const result = await sitemap();

    expect(result).toEqual([
      { url: 'https://ogabassey.com' },
      expect.objectContaining({
        url: 'https://ogabassey.com/warranty',
        changeFrequency: 'monthly',
        priority: 0.5,
      }),
    ]);
  });

  it('omits URLs when normalized summaries are whitespace only', async () => {
    mockResolveStorefrontSitemapContext.mockResolvedValue({
      merchant: {
        id: 'm1',
        slug: 'ogabassey',
        trust_profile: {
          return_policy: { summary: '   ' },
          shipping_policy: { summary: '   ' },
          warranty_policy: { summary: '   ' },
        },
      },
      storeUrl: 'https://ogabassey.com',
    });
    mockGetRootSitemapEntries.mockResolvedValue([
      { url: 'https://ogabassey.com' },
    ]);
    mockBuildMerchantTrustProfile.mockReturnValue({
      returnPolicy: {
        summary: '   ',
        localRoute: '/returns',
      },
      shippingPolicy: {
        summary: '   ',
        localRoute: '/shipping',
      },
      warrantyPolicy: {
        summary: '   ',
        localRoute: '/warranty',
      },
      socialLinks: {},
      derivedLinks: {},
    });

    const { default: sitemap } = await import('./sitemap');
    const result = await sitemap();

    expect(result).toEqual([{ url: 'https://ogabassey.com' }]);
  });
});
