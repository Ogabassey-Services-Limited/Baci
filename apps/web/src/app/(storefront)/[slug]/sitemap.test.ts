import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Mocks ----
const mockHeaders = vi.fn();
const mockResolveStorefrontSitemapContext = vi.fn();
const mockGetStaticSitemapEntries = vi.fn();
const mockGetNamedSitemapEntries = vi.fn();
const mockBuildMerchantTrustProfile = vi.fn();

vi.mock('next/headers', () => ({
  headers: () => mockHeaders(),
}));

vi.mock('./sitemap-data', () => ({
  getStaticSitemapEntries: (...args: unknown[]) =>
    mockGetStaticSitemapEntries(...args),
  getNamedSitemapEntries: (...args: unknown[]) =>
    mockGetNamedSitemapEntries(...args),
  resolveStorefrontSitemapContext: (...args: unknown[]) =>
    mockResolveStorefrontSitemapContext(...args),
}));

vi.mock('@/lib/storefront-trust/build-merchant-trust-profile', () => ({
  buildMerchantTrustProfile: (...args: unknown[]) =>
    mockBuildMerchantTrustProfile(...args),
  hasPublishableReturnsPolicy: (profile: any) => Boolean(profile.returnPolicy),
  hasPublishableShippingPolicy: (profile: any) =>
    Boolean(profile.shippingPolicy),
  hasPublishableWarrantyPolicy: (profile: any) =>
    Boolean(profile.warrantyPolicy),
}));

describe('storefront sitemap root', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHeaders.mockResolvedValue(
      new Headers([['x-custom-domain', 'ogabassey.com']])
    );
  });

  describe('generateSitemaps()', () => {
    it('returns four sitemap IDs', async () => {
      const { generateSitemaps } = await import('./sitemap');
      const sitemaps = generateSitemaps();

      expect(sitemaps).toEqual([
        { id: 'static' },
        { id: 'products' },
        { id: 'categories' },
        { id: 'commercial-support' },
      ]);
    });
  });

  describe('sitemap()', () => {
    it('returns static sitemap entries alongside resolved trust policies', async () => {
      mockResolveStorefrontSitemapContext.mockResolvedValue({
        merchant: {
          id: 'm1',
          slug: 'ogabassey',
        },
        storeUrl: 'https://ogabassey.com',
      });
      mockGetStaticSitemapEntries.mockReturnValue([
        {
          url: 'https://ogabassey.com',
          changeFrequency: 'daily',
          priority: 1.0,
        },
      ]);
      mockBuildMerchantTrustProfile.mockReturnValue({
        returnPolicy: { localRoute: '/returns' },
        shippingPolicy: { localRoute: '/shipping' },
        warrantyPolicy: { localRoute: '/warranty' },
      });

      const { default: sitemap } = await import('./sitemap');
      const result = await sitemap({ id: Promise.resolve('static') });

      expect(result).toEqual([
        {
          url: 'https://ogabassey.com',
          changeFrequency: 'daily',
          priority: 1.0,
        },
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

    it('delegates categories, products, and commercial support sitemaps to getNamedSitemapEntries', async () => {
      mockResolveStorefrontSitemapContext.mockResolvedValue({
        merchant: { id: 'm1', slug: 'ogabassey' },
        storeUrl: 'https://ogabassey.com',
      });
      mockGetNamedSitemapEntries.mockResolvedValue([
        {
          url: 'https://ogabassey.com/smartphones',
          changeFrequency: 'daily',
          priority: 0.7,
        },
      ]);

      const { default: sitemap } = await import('./sitemap');

      const productsResult = await sitemap({ id: 'products' });
      expect(mockGetNamedSitemapEntries).toHaveBeenCalledWith(
        expect.any(Object),
        'products'
      );
      expect(productsResult).toEqual([
        {
          url: 'https://ogabassey.com/smartphones',
          changeFrequency: 'daily',
          priority: 0.7,
        },
      ]);
    });

    it('returns empty array when context cannot be resolved', async () => {
      mockResolveStorefrontSitemapContext.mockResolvedValue(null);

      const { default: sitemap } = await import('./sitemap');
      const result = await sitemap({ id: 'static' });

      expect(result).toEqual([]);
    });
  });
});
