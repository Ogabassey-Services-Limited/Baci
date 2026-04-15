import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockNormalizeStorefrontProductVariants } = vi.hoisted(() => ({
  mockNormalizeStorefrontProductVariants: vi.fn<
    (...args: unknown[]) => Record<string, unknown>[]
  >(() => []),
}));

const mockHeaders = vi.fn();
const mockPermanentRedirect = vi.fn((_url: string) => {
  throw new Error('NEXT_REDIRECT');
});
const mockRedirect = vi.fn((_url: string) => {
  throw new Error('NEXT_REDIRECT');
});
const mockNotFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
const mockGetRequestScopedMerchant = vi.fn();
const mockGetCachedLegacyProductRedirectTarget = vi.fn();
const mockGetCachedProduct = vi.fn();
const mockGetCachedProductWithDetails = vi.fn();
const mockGetCachedProductRatingStats = vi.fn();
const mockGetCachedProductReviews = vi.fn();

vi.mock('next/headers', () => ({
  headers: () => mockHeaders(),
}));

vi.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
  permanentRedirect: (url: string) => mockPermanentRedirect(url),
  redirect: (url: string) => mockRedirect(url),
}));

vi.mock('@/components/ui/skeletons', () => ({
  ProductDetailSkeleton: () => null,
}));

vi.mock('@/lib/cached-data', () => ({
  getRequestScopedMerchant: (...args: unknown[]) =>
    mockGetRequestScopedMerchant(...args),
  getCachedLegacyProductRedirectTarget: (...args: unknown[]) =>
    mockGetCachedLegacyProductRedirectTarget(...args),
  getCachedProduct: (...args: unknown[]) => mockGetCachedProduct(...args),
  getCachedProductWithDetails: (...args: unknown[]) =>
    mockGetCachedProductWithDetails(...args),
  getCachedProductRatingStats: (...args: unknown[]) =>
    mockGetCachedProductRatingStats(...args),
  getCachedProductReviews: (...args: unknown[]) =>
    mockGetCachedProductReviews(...args),
  sanitizeLookupLogValue: (value: unknown) =>
    String(value ?? '')
      .replace(/[\r\n\t]/g, '')
      .substring(0, 100),
}));

vi.mock('@/lib/sanitize-core', () => ({
  escapeHtml: (v: string) => v,
}));

vi.mock('@/lib/sanitize-json-ld', () => ({
  safeJsonLdStringify: () => '{}',
}));

const mockGenerateBreadcrumbSchema = vi.fn((_items: unknown) => ({}));
const mockGenerateProductSchema = vi.fn((..._args: unknown[]) => ({
  offers: {} as Record<string, unknown>,
}));
type ProductUrlInput = {
  id: string;
  slug?: string;
  category?: string | null;
  categories?: { slug?: string } | null;
  category_slug?: string;
};
const defaultGetProductUrl = (product: ProductUrlInput) => {
  const productSlug = product.slug ?? product.id;
  const categorySlug =
    product.categories?.slug ||
    product.category_slug ||
    (product.category
      ? product.category.toLowerCase().replace(/\s+/g, '-')
      : undefined);

  return categorySlug
    ? `/${categorySlug}/${productSlug}`
    : `/products/${productSlug}`;
};
const mockGetProductUrl = vi.fn((product: ProductUrlInput) =>
  defaultGetProductUrl(product)
);

vi.mock('@/lib/seo-utils', () => ({
  constructCanonicalUrl: (base: string) => base,
  generateAggregateRating: () => null,
  generateBreadcrumbSchema: (items: unknown) =>
    mockGenerateBreadcrumbSchema(items),
  generateFAQSchema: () => ({}),
  generateProductSchema: (...args: unknown[]) =>
    mockGenerateProductSchema(...args),
  generateSlug: (name: string) => name.toLowerCase().replace(/\s+/g, '-'),
  getProductUrl: (product: ProductUrlInput) => mockGetProductUrl(product),
}));

vi.mock('@/lib/store-url', () => ({
  buildStoreUrl: (m: { slug: string; custom_domain?: string }) =>
    m.custom_domain
      ? `https://${m.custom_domain}`
      : `https://${m.slug}.usebaci.com`,
}));

vi.mock('@/lib/storefront-product-variants', () => ({
  normalizeStorefrontProductVariants: mockNormalizeStorefrontProductVariants,
}));

vi.mock('@/lib/validation', () => ({
  isDomainIdentifier: (v: string) => v.includes('.'),
  isValidMerchantIdentifier: () => true,
}));

vi.mock('./product-detail-client', () => ({
  default: () => null,
}));

import ProductPage, { generateMetadata } from './page';

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

const uncategorizedDetailedProduct = {
  ...categorizedDetailedProduct,
  id: 'prod-2',
  name: 'Mystery Item',
  slug: 'mystery-item',
  category: undefined,
  categories: null,
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
    vi.unstubAllEnvs();
    vi.stubEnv('NODE_ENV', 'production');
    mockHeaders.mockReset();
    mockHeaders.mockReturnValue(makeHeaders({}));
    mockGenerateProductSchema.mockImplementation(() => ({ offers: {} }));
    mockGetProductUrl.mockImplementation(defaultGetProductUrl);
    mockNormalizeStorefrontProductVariants.mockReset();
    mockNormalizeStorefrontProductVariants.mockReturnValue([]);
    mockGetRequestScopedMerchant.mockResolvedValue(baseMerchant);
    mockGetCachedLegacyProductRedirectTarget.mockResolvedValue(null);
    mockGetCachedProductWithDetails.mockResolvedValue(null);
    mockGetCachedProductRatingStats.mockResolvedValue(null);
    mockGetCachedProductReviews.mockResolvedValue([]);
  });

  it('redirects categorized legacy products during page render in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    mockGetCachedProduct.mockResolvedValue(categorizedProduct);
    mockHeaders.mockReturnValue(makeHeaders({}));

    await expect(
      ProductPage({
        params: Promise.resolve({
          slug: 'teststore',
          productSlug: 'iphone-15',
        }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(mockPermanentRedirect).toHaveBeenCalledWith(
      '/teststore/phones/iphone-15'
    );
  });

  describe('redirect routing mode', () => {
    it('includes slug prefix in development redirects', async () => {
      vi.stubEnv('NODE_ENV', 'development');
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

    it('omits slug prefix in production redirects', async () => {
      mockGetCachedProduct.mockResolvedValue(categorizedProduct);

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

    it('redirects categorized products during page render in production', async () => {
      mockGetCachedProduct.mockResolvedValue(categorizedProduct);
      mockHeaders.mockReturnValue(makeHeaders({}));

      await expect(
        ProductPage({
          params: Promise.resolve({
            slug: 'teststore',
            productSlug: 'iphone-15',
          }),
          searchParams: Promise.resolve({}),
        })
      ).rejects.toThrow('NEXT_REDIRECT');

      expect(mockPermanentRedirect).toHaveBeenCalledWith('/phones/iphone-15');
    });

    it('preserves the development slug prefix during page render', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      mockGetCachedProduct.mockResolvedValue(categorizedProduct);
      mockHeaders.mockReturnValue(makeHeaders({}));

      await expect(
        ProductPage({
          params: Promise.resolve({
            slug: 'teststore',
            productSlug: 'iphone-15',
          }),
          searchParams: Promise.resolve({}),
        })
      ).rejects.toThrow('NEXT_REDIRECT');

      expect(mockPermanentRedirect).toHaveBeenCalledWith(
        '/teststore/phones/iphone-15'
      );
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
      expect(metadata.alternates?.canonical).toBe(
        'https://teststore.usebaci.com/products/mystery-item'
      );
      expect(metadata.title).toContain('Mystery Item');
    });
  });

  it('redirects attribute-only variant params back to the bare family URL', async () => {
    mockGetCachedProduct.mockResolvedValue(null);
    mockGetCachedProductWithDetails.mockResolvedValue(
      uncategorizedDetailedProduct
    );
    mockNormalizeStorefrontProductVariants.mockReturnValue([
      {
        id: 'variant-new-128',
        attributes: { storage: '128GB', connectivity: 'WiFi' },
        condition: 'new',
        stock_quantity: 5,
      },
      {
        id: 'variant-used-128',
        attributes: { storage: '128GB', connectivity: 'WiFi' },
        condition: 'used',
        stock_quantity: 3,
      },
    ]);

    await expect(
      generateMetadata(
        {
          params: Promise.resolve({
            slug: 'teststore',
            productSlug: 'mystery-item',
          }),
          searchParams: Promise.resolve({
            storage: '128GB',
            utm_source: 'google',
          }),
        },
        Promise.resolve({}) as never
      )
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(mockRedirect).toHaveBeenCalledWith('/products/mystery-item');
  });

  it('redirects legacy archived variant slugs to the active parent product', async () => {
    mockGetCachedProduct.mockResolvedValue(null);
    mockGetCachedProductWithDetails.mockResolvedValue(null);
    mockGetCachedLegacyProductRedirectTarget.mockResolvedValue({
      id: 'parent-1',
      name: 'iPhone 13 Pro Max',
      slug: 'iphone-13-pro-max',
      category: 'Phones',
      categories: { id: 'cat-1', name: 'Phones', slug: 'phones' },
    });
    mockHeaders.mockReturnValue(
      makeHeaders({ 'x-custom-domain': 'teststore.com' })
    );

    await expect(
      generateMetadata(
        {
          params: Promise.resolve({
            slug: 'teststore.com',
            productSlug: 'iphone-13-pro-max-6gb-128gb',
          }),
          searchParams: Promise.resolve({}),
        },
        Promise.resolve({}) as never
      )
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(mockGetCachedLegacyProductRedirectTarget).toHaveBeenCalledWith(
      'merchant-1',
      'iphone-13-pro-max-6gb-128gb'
    );
    expect(mockPermanentRedirect).toHaveBeenCalledWith(
      '/phones/iphone-13-pro-max'
    );
  });

  it('redirects legacy archived variant slugs during page render too', async () => {
    mockGetCachedProduct.mockResolvedValue(null);
    mockGetCachedProductWithDetails.mockResolvedValue(null);
    mockGetCachedLegacyProductRedirectTarget.mockResolvedValue({
      id: 'parent-1',
      name: 'iPhone 13 Pro Max',
      slug: 'iphone-13-pro-max',
      category: 'Phones',
      categories: { id: 'cat-1', name: 'Phones', slug: 'phones' },
    });
    mockHeaders.mockReturnValue(
      makeHeaders({ 'x-custom-domain': 'teststore.com' })
    );

    await expect(
      ProductPage({
        params: Promise.resolve({
          slug: 'teststore.com',
          productSlug: 'iphone-13-pro-max-6gb-128gb',
        }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(mockGetCachedLegacyProductRedirectTarget).toHaveBeenCalledWith(
      'merchant-1',
      'iphone-13-pro-max-6gb-128gb'
    );
    expect(mockPermanentRedirect).toHaveBeenCalledWith(
      '/phones/iphone-13-pro-max'
    );
  });

  it('calls notFound when product does not exist and no legacy redirect target exists', async () => {
    mockGetCachedProduct.mockResolvedValue(null);
    mockGetCachedProductWithDetails.mockResolvedValue(null);
    mockHeaders.mockReturnValue(makeHeaders({}));

    await expect(
      generateMetadata(
        {
          params: Promise.resolve({
            slug: 'teststore',
            productSlug: 'nonexistent',
          }),
          searchParams: Promise.resolve({}),
        },
        Promise.resolve({}) as never
      )
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(mockPermanentRedirect).not.toHaveBeenCalled();
  });

  it('calls notFound during page render when no legacy redirect target exists', async () => {
    mockGetCachedProduct.mockResolvedValue(null);
    mockGetCachedProductWithDetails.mockResolvedValue(null);
    mockHeaders.mockReturnValue(makeHeaders({}));

    await expect(
      ProductPage({
        params: Promise.resolve({
          slug: 'teststore',
          productSlug: 'nonexistent',
        }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');

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
    expect(mockPermanentRedirect).toHaveBeenCalledWith('/phones/iphone-15');
  });

  it('does not retry detailed lookup with a lowercased slug', async () => {
    mockGetCachedProduct.mockResolvedValue(null);
    mockGetCachedProductWithDetails.mockResolvedValue(null);

    await expect(
      generateMetadata(
        {
          params: Promise.resolve({
            slug: 'teststore',
            productSlug: 'IPHONE-15',
          }),
          searchParams: Promise.resolve({}),
        },
        Promise.resolve({}) as never
      )
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(mockGetCachedProductWithDetails).toHaveBeenCalledTimes(1);
    expect(mockGetCachedProductWithDetails).toHaveBeenCalledWith(
      'merchant-1',
      'IPHONE-15'
    );
  });

  describe('schema URL consistency', () => {
    it('uses getProductUrl for offer and breadcrumb URLs on fallback legacy pages', async () => {
      mockGetCachedProduct.mockResolvedValue(uncategorizedProduct);
      mockHeaders.mockReturnValue(makeHeaders({}));
      mockGetProductUrl.mockReturnValue('/products/mystery-item');
      const productSchema = { offers: {} as Record<string, unknown> };
      mockGenerateProductSchema.mockReturnValue(productSchema);

      await ProductPage({
        params: Promise.resolve({
          slug: 'teststore',
          productSlug: 'mystery-item',
        }),
        searchParams: Promise.resolve({}),
      });

      // getProductUrl should have been called
      expect(mockGetProductUrl).toHaveBeenCalled();
      expect(productSchema.offers).toMatchObject({
        url: 'https://teststore.usebaci.com/products/mystery-item',
      });

      // Breadcrumb schema should receive the same product URL
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
