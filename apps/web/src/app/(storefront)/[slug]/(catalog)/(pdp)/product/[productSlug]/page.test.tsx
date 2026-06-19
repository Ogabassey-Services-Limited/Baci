import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockNotFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
const mockPermanentRedirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const mockConnection = vi.fn<() => Promise<void>>(() => Promise.resolve());
const mockGetMerchantByIdentifier = vi.fn();
const mockGetCachedProductWithDetails = vi.fn();
const mockGetCachedLegacyProductRedirectTarget = vi.fn();

vi.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
  permanentRedirect: (url: string) => mockPermanentRedirect(url),
}));

vi.mock('next/server', () => ({
  connection: () => mockConnection(),
}));

vi.mock('@/lib/cached-data', () => ({
  getMerchantByIdentifier: (...args: unknown[]) =>
    mockGetMerchantByIdentifier(...args),
  getCachedProductWithDetails: (...args: unknown[]) =>
    mockGetCachedProductWithDetails(...args),
  getCachedLegacyProductRedirectTarget: (...args: unknown[]) =>
    mockGetCachedLegacyProductRedirectTarget(...args),
}));

vi.mock('@/lib/validation', () => ({
  isValidMerchantIdentifier: (value: string) => value !== 'images',
}));

vi.mock('@/lib/seo-utils', () => ({
  getProductUrl: (product: { slug: string; category?: string | null }) => {
    if (product.category) {
      const categorySlug = product.category.toLowerCase().replace(/\s+/g, '-');
      return `/${categorySlug}/${product.slug}`;
    }

    return `/products/${product.slug}`;
  },
}));

vi.mock('../../products/[productSlug]/build-product-redirect-path', () => ({
  buildProductRedirectPath: (slug: string, productPath: string) =>
    `/redirect/${slug}${productPath}`,
}));

import LegacyProductPage, { metadata } from './page';

describe('legacy singular product route', () => {
  it('marks the redirect-only route noindex without inheriting a root canonical', () => {
    expect(metadata.robots).toMatchObject({ index: false, follow: true });
    expect(metadata.alternates).toBeNull();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockConnection.mockResolvedValue(undefined);
    mockGetMerchantByIdentifier.mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
    });
    mockGetCachedProductWithDetails.mockResolvedValue(null);
    mockGetCachedLegacyProductRedirectTarget.mockResolvedValue(null);
  });

  it('redirects directly to the canonical categorized product path', async () => {
    mockGetCachedProductWithDetails.mockResolvedValue({
      slug: 'wrc-9-playstation-5',
      category: 'PlayStation 5',
    });

    await expect(
      LegacyProductPage({
        params: Promise.resolve({
          slug: 'ogabassey',
          productSlug: 'wrc-9-playstation-5',
        }),
      })
    ).rejects.toThrow(
      'NEXT_REDIRECT:/redirect/ogabassey/playstation-5/wrc-9-playstation-5'
    );

    expect(mockPermanentRedirect).toHaveBeenCalledWith(
      '/redirect/ogabassey/playstation-5/wrc-9-playstation-5'
    );
    expect(mockConnection).toHaveBeenCalledOnce();
  });

  it('returns notFound for invalid non-storefront slugs', async () => {
    await expect(
      LegacyProductPage({
        params: Promise.resolve({
          slug: 'images',
          productSlug: 'iphone-17-pro-max.png',
        }),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(mockGetMerchantByIdentifier).not.toHaveBeenCalled();
    expect(mockConnection).toHaveBeenCalledOnce();
  });

  it('throws notFound before returning streamed body markup for missing legacy products', async () => {
    await expect(
      LegacyProductPage({
        params: Promise.resolve({
          slug: 'ogabassey',
          productSlug: 'missing-product',
        }),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(mockGetCachedLegacyProductRedirectTarget).toHaveBeenCalledWith(
      'merchant-1',
      'missing-product'
    );
    expect(mockNotFound).toHaveBeenCalled();
  });

  it('surfaces request-time rendering failures before resolving redirects', async () => {
    mockConnection.mockRejectedValueOnce(new Error('connection failed'));

    await expect(
      LegacyProductPage({
        params: Promise.resolve({
          slug: 'ogabassey',
          productSlug: 'wrc-9-playstation-5',
        }),
      })
    ).rejects.toThrow('connection failed');

    expect(mockGetMerchantByIdentifier).not.toHaveBeenCalled();
  });
});
