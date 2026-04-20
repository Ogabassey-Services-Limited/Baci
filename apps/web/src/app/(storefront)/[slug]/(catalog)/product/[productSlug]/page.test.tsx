import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockNotFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
const mockPermanentRedirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const mockGetMerchantByIdentifier = vi.fn();
const mockGetCachedProductWithDetails = vi.fn();
const mockGetCachedLegacyProductRedirectTarget = vi.fn();

vi.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
  permanentRedirect: (url: string) => mockPermanentRedirect(url),
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

import LegacyProductPage from './page';

describe('legacy singular product route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  });
});
