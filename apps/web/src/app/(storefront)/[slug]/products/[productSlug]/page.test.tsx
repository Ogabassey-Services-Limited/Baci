import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockHeaders = vi.fn();
const mockPermanentRedirect = vi.fn((_url: string) => {
  throw new Error('NEXT_REDIRECT');
});
const mockNotFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
const mockGetCachedMerchant = vi.fn();
const mockGetCachedMerchantByDomain = vi.fn();
const mockGetCachedProduct = vi.fn();
const mockGetCachedProductWithDetails = vi.fn();
const mockGetCachedProductRatingStats = vi.fn();
const mockGetCachedProductReviews = vi.fn();

vi.mock('next/headers', () => ({
  headers: () => mockHeaders(),
}));

vi.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
  permanentRedirect: (url: never) => mockPermanentRedirect(url),
}));

vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return { ...actual };
});

vi.mock('@/components/ui/skeletons', () => ({
  ProductDetailSkeleton: () => null,
}));

vi.mock('@/lib/cached-data', () => ({
  getCachedMerchant: (...args: unknown[]) => mockGetCachedMerchant(...args),
  getCachedMerchantByDomain: (...args: unknown[]) =>
    mockGetCachedMerchantByDomain(...args),
  getCachedProduct: (...args: unknown[]) => mockGetCachedProduct(...args),
  getCachedProductWithDetails: (...args: unknown[]) =>
    mockGetCachedProductWithDetails(...args),
  getCachedProductRatingStats: (...args: unknown[]) =>
    mockGetCachedProductRatingStats(...args),
  getCachedProductReviews: (...args: unknown[]) =>
    mockGetCachedProductReviews(...args),
}));

vi.mock('@/lib/sanitize-core', () => ({
  escapeHtml: (v: string) => v,
}));

vi.mock('@/lib/sanitize-json-ld', () => ({
  safeJsonLdStringify: () => '{}',
}));

const mockGenerateBreadcrumbSchema = vi.fn((_items: unknown) => ({}));
const mockGetProductUrl = vi.fn(
  (_product: unknown) => '/products/test-product'
);

vi.mock('@/lib/seo-utils', () => ({
  constructCanonicalUrl: (base: string) => base,
  generateAggregateRating: () => null,
  generateBreadcrumbSchema: (items: unknown) =>
    mockGenerateBreadcrumbSchema(items),
  generateFAQSchema: () => ({}),
  generateProductSchema: () => ({ offers: {} }),
  generateSlug: (name: string) => name.toLowerCase().replace(/\s+/g, '-'),
  getProductUrl: (product: unknown) => mockGetProductUrl(product),
}));

vi.mock('@/lib/store-url', () => ({
  buildStoreUrl: (m: { slug: string; custom_domain?: string }) =>
    m.custom_domain
      ? `https://${m.custom_domain}`
      : `https://${m.slug}.usebaci.com`,
}));

vi.mock('@/lib/storefront-product-variants', () => ({
  normalizeStorefrontProductVariants: () => [],
}));

vi.mock('@/lib/validation', () => ({
  isDomainIdentifier: (v: string) => v.includes('.'),
  isValidMerchantIdentifier: () => true,
}));

vi.mock('./product-detail-client', () => ({
  default: () => null,
}));

import { generateMetadata } from './page';

const baseMerchant = {
  id: 'merchant-1',
  business_name: 'TestStore',
  slug: 'teststore',
  logo_url: null,
  payout_currency: 'NGN',
  country: 'NG',
};

const categorizedProduct = {
  id: 'prod-1',
  name: 'iPhone 15',
  slug: 'iphone-15',
  description: 'A phone',
  status: 'active',
  base_price: 500000,
  sale_price: null,
  track_quantity: false,
  quantity: 10,
  images: [],
  product_variants: [],
  product_categories: [
    { categories: { id: 'cat-1', name: 'Phones', slug: 'phones' } },
  ],
  specifications: null,
  product_key_specs: null,
  category_slug: 'phones',
};

const categorizedDetailedProduct = {
  id: 'prod-1',
  merchant_id: 'merchant-1',
  name: 'iPhone 15',
  slug: 'iphone-15',
  description: 'A phone',
  status: 'active',
  price: 500000,
  compare_at_price: null,
  manage_stock: false,
  stock: 10,
  stock_quantity: 10,
  images: [],
  imageHint: null,
  brand: null,
  gtin: null,
  mpn: null,
  category: 'Phones',
  categories: { id: 'cat-1', name: 'Phones', slug: 'phones', parent_id: null },
  product_variants: [],
  specifications: null,
  product_key_specs: null,
};

const uncategorizedProduct = {
  ...categorizedProduct,
  id: 'prod-2',
  name: 'Mystery Item',
  slug: 'mystery-item',
  product_categories: [],
  category_slug: undefined,
};

function makeHeaders(entries: Record<string, string> = {}) {
  const map = new Map(Object.entries(entries));
  return {
    has: (key: string) => map.has(key),
    get: (key: string) => map.get(key) ?? null,
  };
}

describe('products/[productSlug] page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCachedMerchant.mockResolvedValue(baseMerchant);
    mockGetCachedProductWithDetails.mockResolvedValue(null);
    mockGetCachedProductRatingStats.mockResolvedValue(null);
    mockGetCachedProductReviews.mockResolvedValue([]);
  });

  describe('redirect routing mode', () => {
    it('includes slug prefix in path-mode redirect (no proxy headers)', async () => {
      mockGetCachedProduct.mockResolvedValue(categorizedProduct);
      mockHeaders.mockReturnValue(makeHeaders({}));

      await expect(
        generateMetadata(
          {
            params: Promise.resolve({
              slug: 'teststore',
              productSlug: 'iphone-15',
            }),
            searchParams: Promise.resolve({}),
          },
          Promise.resolve({}) as never
        )
      ).rejects.toThrow('NEXT_REDIRECT');

      expect(mockPermanentRedirect).toHaveBeenCalledWith(
        '/teststore/phones/iphone-15'
      );
    });

    it('omits slug prefix in subdomain-mode redirect (x-merchant-slug header)', async () => {
      mockGetCachedProduct.mockResolvedValue(categorizedProduct);
      mockHeaders.mockReturnValue(
        makeHeaders({ 'x-merchant-slug': 'teststore' })
      );

      await expect(
        generateMetadata(
          {
            params: Promise.resolve({
              slug: 'teststore',
              productSlug: 'iphone-15',
            }),
            searchParams: Promise.resolve({}),
          },
          Promise.resolve({}) as never
        )
      ).rejects.toThrow('NEXT_REDIRECT');

      expect(mockPermanentRedirect).toHaveBeenCalledWith('/phones/iphone-15');
    });

    it('omits slug prefix in custom-domain-mode redirect (x-custom-domain header)', async () => {
      mockGetCachedProduct.mockResolvedValue(categorizedProduct);
      mockGetCachedMerchantByDomain.mockResolvedValue(baseMerchant);
      mockHeaders.mockReturnValue(
        makeHeaders({ 'x-custom-domain': 'teststore.com' })
      );

      await expect(
        generateMetadata(
          {
            params: Promise.resolve({
              slug: 'teststore.com',
              productSlug: 'iphone-15',
            }),
            searchParams: Promise.resolve({}),
          },
          Promise.resolve({}) as never
        )
      ).rejects.toThrow('NEXT_REDIRECT');

      expect(mockPermanentRedirect).toHaveBeenCalledWith('/phones/iphone-15');
    });
  });

  describe('uncategorized product', () => {
    it('renders metadata instead of redirecting when product has no category', async () => {
      mockGetCachedProduct.mockResolvedValue(uncategorizedProduct);

      const metadata = await generateMetadata(
        {
          params: Promise.resolve({
            slug: 'teststore',
            productSlug: 'mystery-item',
          }),
          searchParams: Promise.resolve({}),
        },
        Promise.resolve({}) as never
      );

      expect(mockPermanentRedirect).not.toHaveBeenCalled();
      expect(metadata.title).toContain('Mystery Item');
    });
  });

  it('returns not-found metadata when product does not exist', async () => {
    mockGetCachedProduct.mockResolvedValue(null);
    mockGetCachedProductWithDetails.mockResolvedValue(null);

    const metadata = await generateMetadata(
      {
        params: Promise.resolve({
          slug: 'teststore',
          productSlug: 'nonexistent',
        }),
        searchParams: Promise.resolve({}),
      },
      Promise.resolve({}) as never
    );

    expect(metadata.title).toBe('Product Not Found');
    expect(mockPermanentRedirect).not.toHaveBeenCalled();
  });

  it('falls back to detailed product lookup before returning not-found metadata', async () => {
    mockGetCachedProduct.mockResolvedValue(null);
    mockGetCachedProductWithDetails.mockResolvedValue(
      categorizedDetailedProduct
    );
    mockHeaders.mockReturnValue(makeHeaders({}));

    await expect(
      generateMetadata(
        {
          params: Promise.resolve({
            slug: 'teststore',
            productSlug: 'iphone-15',
          }),
          searchParams: Promise.resolve({}),
        },
        Promise.resolve({}) as never
      )
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(mockGetCachedProductWithDetails).toHaveBeenCalledWith(
      'merchant-1',
      'iphone-15'
    );
    expect(mockPermanentRedirect).toHaveBeenCalledWith(
      '/teststore/phones/iphone-15'
    );
  });

  describe('schema URL consistency', () => {
    it('uses getProductUrl for both offers and breadcrumb URLs with categorized product', async () => {
      mockGetCachedProduct.mockResolvedValue(uncategorizedProduct);
      mockHeaders.mockReturnValue(makeHeaders({}));
      mockGetProductUrl.mockReturnValue('/phones/iphone-15');

      // Import and call the page component directly
      const { default: ProductPage } = await import('./page');
      await ProductPage({
        params: Promise.resolve({
          slug: 'teststore',
          productSlug: 'mystery-item',
        }),
        searchParams: Promise.resolve({}),
      });

      // getProductUrl should have been called
      expect(mockGetProductUrl).toHaveBeenCalled();

      // Breadcrumb schema should receive the same product URL
      expect(mockGenerateBreadcrumbSchema).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            url: expect.stringContaining('/phones/iphone-15'),
          }),
        ])
      );
    });

    it('uses /products/ fallback path when product has no category', async () => {
      mockGetCachedProduct.mockResolvedValue(uncategorizedProduct);
      mockHeaders.mockReturnValue(makeHeaders({}));
      mockGetProductUrl.mockReturnValue('/products/mystery-item');

      const { default: ProductPage } = await import('./page');
      await ProductPage({
        params: Promise.resolve({
          slug: 'teststore',
          productSlug: 'mystery-item',
        }),
        searchParams: Promise.resolve({}),
      });

      expect(mockGenerateBreadcrumbSchema).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            url: expect.stringContaining('/products/mystery-item'),
          }),
        ])
      );
    });
  });
});
