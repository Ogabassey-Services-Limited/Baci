import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
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
const mockGetCachedCategoryPageData = vi.fn();
const mockBuildProductSemanticModel = vi.fn();
const mockGetPublishedClusterPosts = vi.fn();

vi.mock('next/headers', () => ({
  headers: () => mockHeaders(),
}));

vi.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
  permanentRedirect: (url: string) => mockPermanentRedirect(url),
  redirect: (url: string) => mockRedirect(url),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
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
  getCachedCategoryPageData: (...args: unknown[]) =>
    mockGetCachedCategoryPageData(...args),
  sanitizeLookupLogValue: (value: unknown) =>
    String(value ?? '')
      .replace(/[\r\n\t]/g, '')
      .substring(0, 100),
}));

vi.mock('@/lib/storefront-product/build-product-semantic-model', () => ({
  buildProductSemanticModel: (...args: unknown[]) =>
    mockBuildProductSemanticModel(...args),
}));

vi.mock('@/lib/storefront-content/get-published-cluster-posts', () => ({
  getPublishedClusterPosts: (...args: unknown[]) =>
    mockGetPublishedClusterPosts(...args),
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
  generateMetaDescription: (description: string, maxLength = 160) => {
    const plainText = description.replace(/<[^>]+>/g, '').trim();
    return plainText.length <= maxLength
      ? plainText
      : `${plainText.slice(0, maxLength - 3)}...`;
  },
  generateFAQSchema: () => ({}),
  generateProductSchema: (...args: unknown[]) =>
    mockGenerateProductSchema(...args),
  generateSlug: (name: string) => name.toLowerCase().replace(/\s+/g, '-'),
  getIndexableRobotsMetadata: () => ({
    index: true,
    follow: true,
    'max-image-preview': 'large',
    'max-snippet': -1,
    'max-video-preview': -1,
  }),
  getProductUrl: (product: ProductUrlInput) => mockGetProductUrl(product),
}));

vi.mock('@/lib/store-url', () => ({
  buildStoreUrl: (m: { slug: string; custom_domain?: string }) =>
    m.custom_domain
      ? `https://${m.custom_domain}`
      : `https://${m.slug}.usebaci.com`,
  buildRequestScopedStoreUrl: (
    merchant: { slug: string; custom_domain?: string },
    _headers: Headers
  ) =>
    merchant.custom_domain
      ? `https://${merchant.custom_domain}`
      : `https://${merchant.slug}.usebaci.com`,
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
    mockGetCachedCategoryPageData.mockReset();
    mockGetCachedCategoryPageData.mockResolvedValue(null);
    mockGetPublishedClusterPosts.mockReset();
    mockGetPublishedClusterPosts.mockResolvedValue([]);
    mockBuildProductSemanticModel.mockReset();
    mockBuildProductSemanticModel.mockReturnValue({
      trustBullets: [],
      supportLinks: [],
      guideLinks: [],
      alternatives: null,
      sameBrand: null,
      samePrice: null,
    });
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

    expect(mockRedirect).toHaveBeenCalledWith(
      '/products/mystery-item?utm_source=google'
    );
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

  it('strips HTML from product metadata descriptions', async () => {
    mockGetCachedProduct.mockResolvedValue({
      ...uncategorizedProduct,
      description:
        '<p>The <strong>best</strong> phone for creators and gamers.</p>',
      images: ['https://cdn.example.com/products/mystery-item.png'],
    });

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

    expect(metadata.description).toBe(
      'The best phone for creators and gamers.'
    );
    expect(metadata.robots).toMatchObject({
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    });
    expect(metadata.openGraph?.description).toBe(
      'The best phone for creators and gamers.'
    );
    expect(metadata.twitter?.description).toBe(
      'The best phone for creators and gamers.'
    );
    expect(metadata.other).toMatchObject({
      'product:price:amount': '500000',
      'product:price:currency': 'NGN',
      'product:availability': 'in stock',
      'twitter:label1': 'Price',
      'twitter:data1': 'NGN 500000',
      'twitter:label2': 'Availability',
      'twitter:data2': 'In stock',
    });
    expect(metadata.openGraph?.images).toEqual([
      {
        url: 'https://cdn.example.com/products/mystery-item.png',
        alt: 'Mystery Item',
      },
    ]);
    expect(metadata.twitter?.images).toEqual([
      'https://cdn.example.com/products/mystery-item.png',
    ]);
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

  it('renders server semantic sections on the generic PDP route', async () => {
    mockGetRequestScopedMerchant.mockResolvedValue({
      ...baseMerchant,
      support_email: 'support@test.example',
      support_phone: '+2348000000000',
      trust_profile: {
        return_policy: {
          summary: 'Returns accepted within 7 days.',
          window_days: 7,
          return_method: 'mail',
          return_fees: 'free',
        },
        shipping_policy: {
          summary: 'Ships across Nigeria.',
          regions: ['NG'],
          handling_days_min: 1,
          handling_days_max: 2,
          transit_days_min: 3,
          transit_days_max: 5,
          shipping_fee_type: 'free',
        },
        customer_service: {
          whatsapp_number: '+2349000000000',
        },
      },
    });
    mockGetCachedProduct.mockResolvedValue({
      ...uncategorizedProduct,
      slug: 'iphone-17-pro-max',
      name: 'iPhone 17 Pro Max',
    });
    mockGetCachedCategoryPageData.mockResolvedValue({
      isCollection: false,
      fallbackName: 'Products',
      products: [
        {
          slug: 'iphone-17-pro-max',
          name: 'iPhone 17 Pro Max',
          brand: 'Apple',
          price: 495000,
          category_slug: 'products',
          product_key_specs: {
            chipset: 'A19 Pro',
            ram_gb: 8,
            storage_gb: 256,
          },
        },
        {
          slug: 'samsung-galaxy-z-trifold',
          name: 'Samsung Galaxy Z TriFold',
          brand: 'Samsung',
          price: 480000,
          category_slug: 'products',
          product_key_specs: {
            chipset: 'Snapdragon 8 Elite',
            ram_gb: 16,
            storage_gb: 512,
          },
        },
      ],
    });
    mockBuildProductSemanticModel.mockReturnValue({
      trustBullets: [],
      supportLinks: [
        {
          href: 'https://teststore.usebaci.com/products',
          label: 'Shop more Products',
        },
        {
          href: 'https://teststore.usebaci.com/products/compare/iphone-17-pro-max-vs-samsung-galaxy-z-trifold',
          label: 'Compare with Samsung Galaxy Z TriFold',
        },
      ],
      guideLinks: [
        {
          href: 'https://teststore.usebaci.com/blog/best-phones-in-nigeria',
          title: 'Best Phones in Nigeria',
          description: 'Budget and flagship picks.',
          kind: 'best-in-nigeria',
        },
      ],
      alternatives: null,
      sameBrand: null,
      samePrice: null,
    });

    render(
      await ProductPage({
        params: Promise.resolve({
          slug: 'teststore',
          productSlug: 'iphone-17-pro-max',
        }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(
      screen.getByRole('link', {
        name: /Shop more Products/i,
      })
    ).toHaveAttribute('href', 'https://teststore.usebaci.com/products');
    expect(
      screen.getByRole('link', {
        name: /Compare with Samsung Galaxy Z TriFold/i,
      })
    ).toHaveAttribute(
      'href',
      'https://teststore.usebaci.com/products/compare/iphone-17-pro-max-vs-samsung-galaxy-z-trifold'
    );
    expect(
      screen.getByRole('link', {
        name: 'Best Phones in Nigeria',
      })
    ).toHaveAttribute(
      'href',
      'https://teststore.usebaci.com/blog/best-phones-in-nigeria'
    );
    expect(screen.getByText('Free returns within 7 days')).toBeInTheDocument();
    expect(screen.getByText('Ships across Nigeria')).toBeInTheDocument();
    expect(screen.getByText('WhatsApp support available')).toBeInTheDocument();
    expect(mockBuildProductSemanticModel).toHaveBeenCalledWith(
      expect.objectContaining({
        storeUrl: 'https://teststore.usebaci.com',
        categorySlug: 'products',
        currentProduct: expect.objectContaining({
          slug: 'iphone-17-pro-max',
        }),
        inventory: expect.arrayContaining([
          expect.objectContaining({
            slug: 'samsung-galaxy-z-trifold',
            category_slug: 'products',
          }),
        ]),
        guidePosts: [],
      })
    );
    expect(mockGenerateProductSchema).toHaveBeenCalledWith(
      expect.anything(),
      'TestStore',
      'NGN',
      'NG',
      null,
      expect.objectContaining({
        supportEmail: 'support@test.example',
        supportPhone: '+2348000000000',
      })
    );
  });
});
