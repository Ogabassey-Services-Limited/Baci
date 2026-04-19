import { render, screen } from '@testing-library/react';
import { type ReactNode, Suspense } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockNormalizeStorefrontProductVariants, mockProductDetailClient } =
  vi.hoisted(() => ({
    mockNormalizeStorefrontProductVariants: vi.fn<
      (...args: unknown[]) => Record<string, unknown>[]
    >(() => []),
    mockProductDetailClient: vi.fn(() => null),
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
const mockGetCachedProductWithDetails = vi.fn();
const mockGetCachedCategoryPageData = vi.fn();
const mockBuildProductSemanticModel = vi.fn();
const mockGetPublishedClusterPosts = vi.fn();
const mockGenerateProductSchema = vi.fn(
  (
    _product: unknown,
    _merchantName?: string,
    _currency?: string,
    _country?: string,
    _merchantLogo?: string | null,
    _trustProfile?: unknown
  ) => ({})
);

vi.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
  permanentRedirect: (url: string) => mockPermanentRedirect(url),
  redirect: (url: string) => mockRedirect(url),
}));

vi.mock('next/headers', () => ({
  headers: () => mockHeaders(),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/components/storefront/ogabassey/pages/product-details-page', () => ({
  ProductDetailsPage: ({
    product,
    semanticSections = null,
  }: {
    product: { name: string };
    semanticSections?: ReactNode;
  }) => (
    <>
      <h1>{product.name}</h1>
      {semanticSections}
    </>
  ),
}));

vi.mock('@/lib/cached-data', () => ({
  getRequestScopedMerchant: (...args: unknown[]) =>
    mockGetRequestScopedMerchant(...args),
  getCachedLegacyProductRedirectTarget: (...args: unknown[]) =>
    mockGetCachedLegacyProductRedirectTarget(...args),
  getCachedProductWithDetails: (...args: unknown[]) =>
    mockGetCachedProductWithDetails(...args),
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

vi.mock('@/lib/product-stock', () => ({
  getEffectiveStock: () => 0,
}));

vi.mock('@/lib/sanitize-core', () => ({
  escapeHtml: (value: string) => value,
}));

vi.mock('@/lib/sanitize-json-ld', () => ({
  safeJsonLdStringify: () => '{}',
}));

vi.mock('@/lib/seo-utils', () => ({
  constructCanonicalUrl: (base: string) => base,
  generateBreadcrumbSchema: () => ({}),
  generateMetaDescription: (description: string, maxLength = 160) => {
    const plainText = description.replace(/<[^>]+>/g, '').trim();
    return plainText.length <= maxLength
      ? plainText
      : `${plainText.slice(0, maxLength - 3)}...`;
  },
  generateProductSchema: (
    product: unknown,
    merchantName?: string,
    currency?: string,
    country?: string,
    merchantLogo?: string | null,
    trustProfile?: unknown
  ) =>
    mockGenerateProductSchema(
      product,
      merchantName,
      currency,
      country,
      merchantLogo,
      trustProfile
    ),
  generateSlug: (name: string) => name.toLowerCase().replace(/\s+/g, '-'),
  getIndexableRobotsMetadata: () => ({
    index: true,
    follow: true,
    'max-image-preview': 'large',
    'max-snippet': -1,
    'max-video-preview': -1,
  }),
  getProductUrl: (product: {
    id: string;
    slug?: string;
    category?: string | null;
    categories?: { slug?: string } | null;
    category_slug?: string;
  }) => {
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
  },
}));

vi.mock('@/lib/store-url', () => ({
  buildStoreUrl: (merchant: { slug: string; custom_domain?: string }) =>
    merchant.custom_domain
      ? `https://${merchant.custom_domain}`
      : `https://${merchant.slug}.usebaci.com`,
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
  isDomainIdentifier: (value: string) => value.includes('.'),
  isValidMerchantIdentifier: (value: string) => {
    const reservedNames = new Set(['images', 'product']);
    return (
      (value.includes('.') ||
        /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(value)) &&
      !reservedNames.has(value.toLowerCase())
    );
  },
}));

vi.mock(
  '@/app/(storefront)/[slug]/(catalog)/products/[productSlug]/product-detail-client',
  () => ({
    default: () => mockProductDetailClient(),
  })
);

import CategoryProductPage, { generateMetadata } from './page';

const baseMerchant = {
  id: 'merchant-1',
  business_name: 'TestStore',
  slug: 'teststore',
  logo_url: null,
  payout_currency: 'NGN',
  country: 'NG',
};

const categorizedDetailedProduct = {
  id: 'prod-1',
  merchant_id: 'merchant-1',
  name: 'HP Laptop 14-ep0063nia',
  slug: 'hp-laptop-14-ep0063nia',
  description: 'A laptop',
  status: 'active',
  price: 645600,
  compare_at_price: null,
  manage_stock: false,
  stock: 10,
  stock_quantity: 10,
  images: [],
  imageHint: null,
  brand: 'HP',
  gtin: null,
  mpn: null,
  category: 'Laptops',
  categories: {
    id: 'cat-1',
    name: 'Laptops',
    slug: 'laptops',
    parent_id: null,
  },
  product_variants: [],
  product_offers: [],
  condition: 'new',
  fulfillmentFields: [],
};

describe('[category]/[productSlug] page metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProductDetailClient.mockReset();
    mockProductDetailClient.mockReturnValue(null);
    mockGenerateProductSchema.mockReset();
    mockHeaders.mockReset();
    mockHeaders.mockResolvedValue(new Headers());
    mockNormalizeStorefrontProductVariants.mockReset();
    mockNormalizeStorefrontProductVariants.mockReturnValue([]);
    mockGetRequestScopedMerchant.mockResolvedValue(baseMerchant);
    mockGetCachedProductWithDetails.mockResolvedValue(null);
    mockGetCachedLegacyProductRedirectTarget.mockResolvedValue(null);
    mockGetPublishedClusterPosts.mockReset();
    mockGetPublishedClusterPosts.mockResolvedValue([]);
  });

  it('redirects legacy archived variant slugs to the active parent product', async () => {
    mockGetCachedLegacyProductRedirectTarget.mockResolvedValue({
      id: 'parent-1',
      name: 'iPhone 13 Pro Max',
      slug: 'iphone-13-pro-max',
      category: 'Phones',
      categories: { id: 'cat-1', name: 'Phones', slug: 'phones' },
    });

    await expect(
      generateMetadata({
        params: Promise.resolve({
          slug: 'teststore',
          category: 'smartphones',
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

  it('calls notFound when the product is missing and no legacy redirect exists', async () => {
    await expect(
      generateMetadata({
        params: Promise.resolve({
          slug: 'teststore',
          category: 'smartphones',
          productSlug: 'missing-product',
        }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(mockPermanentRedirect).not.toHaveBeenCalled();
  });

  it('redirects category mismatch URLs during metadata generation', async () => {
    mockGetCachedProductWithDetails.mockResolvedValue(
      categorizedDetailedProduct
    );

    await expect(
      generateMetadata({
        params: Promise.resolve({
          slug: 'teststore',
          category: 'hp',
          productSlug: 'hp-laptop-14-ep0063nia',
        }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(mockPermanentRedirect).toHaveBeenCalledWith(
      '/laptops/hp-laptop-14-ep0063nia'
    );
  });

  it('redirects mixed-case product slugs during metadata generation', async () => {
    mockGetCachedProductWithDetails
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(categorizedDetailedProduct);

    await expect(
      generateMetadata({
        params: Promise.resolve({
          slug: 'teststore',
          category: 'laptops',
          productSlug: 'HP-LAPTOP-14-EP0063NIA',
        }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(mockGetCachedProductWithDetails).toHaveBeenNthCalledWith(
      1,
      'merchant-1',
      'HP-LAPTOP-14-EP0063NIA'
    );
    expect(mockGetCachedProductWithDetails).toHaveBeenNthCalledWith(
      2,
      'merchant-1',
      'hp-laptop-14-ep0063nia'
    );
    expect(mockPermanentRedirect).toHaveBeenCalledWith(
      '/laptops/hp-laptop-14-ep0063nia'
    );
  });

  it('strips HTML from category product metadata descriptions', async () => {
    mockGetCachedProductWithDetails.mockResolvedValue({
      ...categorizedDetailedProduct,
      description:
        '<p>A <strong>premium</strong> laptop built for creators.</p>',
      images: ['https://cdn.example.com/products/hp-laptop.png'],
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'teststore',
        category: 'laptops',
        productSlug: 'hp-laptop-14-ep0063nia',
      }),
      searchParams: Promise.resolve({}),
    });

    expect(metadata.description).toBe('A premium laptop built for creators.');
    expect(metadata.robots).toMatchObject({
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    });
    expect(metadata.openGraph?.description).toBe(
      'A premium laptop built for creators.'
    );
    expect(metadata.twitter?.description).toBe(
      'A premium laptop built for creators.'
    );
    expect(metadata.other).toMatchObject({
      'product:price:amount': '645600',
      'product:price:currency': 'NGN',
      'product:availability': 'in stock',
      'twitter:label1': 'Price',
      'twitter:data1': 'NGN 645600',
      'twitter:label2': 'Availability',
      'twitter:data2': 'In stock',
    });
    expect(metadata.openGraph?.images).toEqual([
      {
        url: 'https://cdn.example.com/products/hp-laptop.png',
        alt: 'HP Laptop 14-ep0063nia',
      },
    ]);
    expect(metadata.twitter?.images).toEqual([
      'https://cdn.example.com/products/hp-laptop.png',
    ]);
  });

  it('redirects attribute-only variant params to the bare family URL', async () => {
    mockGetCachedProductWithDetails.mockResolvedValue(
      categorizedDetailedProduct
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
      generateMetadata({
        params: Promise.resolve({
          slug: 'teststore',
          category: 'laptops',
          productSlug: 'hp-laptop-14-ep0063nia',
        }),
        searchParams: Promise.resolve({
          storage: '128GB',
          utm_source: 'google',
        }),
      })
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(mockPermanentRedirect).toHaveBeenCalledWith(
      '/laptops/hp-laptop-14-ep0063nia'
    );
  });
});

describe('[category]/[productSlug] page render', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProductDetailClient.mockReset();
    mockProductDetailClient.mockReturnValue(null);
    mockHeaders.mockReset();
    mockHeaders.mockResolvedValue(new Headers());
    mockNormalizeStorefrontProductVariants.mockReset();
    mockNormalizeStorefrontProductVariants.mockReturnValue([]);
    mockGetRequestScopedMerchant.mockResolvedValue({
      ...baseMerchant,
      template_id: 'ogabassey',
    });
    mockGetCachedProductWithDetails.mockResolvedValue(
      categorizedDetailedProduct
    );
    mockGetCachedLegacyProductRedirectTarget.mockResolvedValue(null);
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

  it('renders only the visible product heading for the page', async () => {
    const ui = await CategoryProductPage({
      params: Promise.resolve({
        slug: 'teststore',
        category: 'laptops',
        productSlug: 'hp-laptop-14-ep0063nia',
      }),
      searchParams: Promise.resolve({}),
    });

    const { container } = render(ui);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'HP Laptop 14-ep0063nia',
      })
    ).toBeInTheDocument();
    expect(container.querySelectorAll('h1')).toHaveLength(1);
  });

  it('defers category PDP first paint to the route loader while the client page is pending', async () => {
    mockGetRequestScopedMerchant.mockResolvedValue({
      ...baseMerchant,
      template_id: 'default',
    });
    mockProductDetailClient.mockImplementation(() => {
      throw new Promise(() => {
        // Keep the detail client suspended after route data resolves.
      });
    });

    render(
      <Suspense fallback={<div>Route loader fallback</div>}>
        {
          await CategoryProductPage({
            params: Promise.resolve({
              slug: 'teststore',
              category: 'laptops',
              productSlug: 'hp-laptop-14-ep0063nia',
            }),
            searchParams: Promise.resolve({}),
          })
        }
      </Suspense>
    );

    expect(screen.getByText('Route loader fallback')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', {
        level: 1,
        name: 'HP Laptop 14-ep0063nia',
      })
    ).not.toBeInTheDocument();
  });

  it('passes the shared semantic sections into the Ogabassey PDP surface', async () => {
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
    mockGetCachedProductWithDetails.mockResolvedValue({
      ...categorizedDetailedProduct,
      name: 'Samsung Galaxy Z TriFold',
      slug: 'samsung-galaxy-z-trifold',
      brand: 'Samsung',
      category: 'Smartphones',
      categories: {
        id: 'cat-smartphones',
        name: 'Smartphones',
        slug: 'smartphones',
        parent_id: null,
      },
    });
    mockGetCachedCategoryPageData.mockResolvedValue({
      isCollection: false,
      fallbackName: 'Smartphones',
      products: [
        {
          slug: 'samsung-galaxy-z-trifold',
          name: 'Samsung Galaxy Z TriFold',
          brand: 'Samsung',
          price: 480000,
          category_slug: 'smartphones',
          product_key_specs: {
            chipset: 'Snapdragon 8 Elite',
            ram_gb: 16,
            storage_gb: 512,
          },
        },
        {
          slug: 'iphone-17-pro-max',
          name: 'iPhone 17 Pro Max',
          brand: 'Apple',
          price: 495000,
          category_slug: 'smartphones',
          product_key_specs: {
            chipset: 'A19 Pro',
            ram_gb: 8,
            storage_gb: 256,
          },
        },
      ],
    });
    mockBuildProductSemanticModel.mockReturnValue({
      trustBullets: [],
      supportLinks: [
        {
          href: 'https://teststore.usebaci.com/smartphones',
          label: 'Shop more Smartphones',
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
      await CategoryProductPage({
        params: Promise.resolve({
          slug: 'teststore',
          category: 'smartphones',
          productSlug: 'samsung-galaxy-z-trifold',
        }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(
      screen.getByRole('link', {
        name: /Shop more Smartphones/i,
      })
    ).toHaveAttribute('href', 'https://teststore.usebaci.com/smartphones');
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
        categorySlug: 'smartphones',
        currentProduct: expect.objectContaining({
          slug: 'samsung-galaxy-z-trifold',
        }),
        inventory: expect.arrayContaining([
          expect.objectContaining({
            slug: 'iphone-17-pro-max',
            category_slug: 'smartphones',
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

  it('keeps the canonical URL on the bare family path', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'teststore',
        category: 'laptops',
        productSlug: 'hp-laptop-14-ep0063nia',
      }),
      searchParams: Promise.resolve({
        condition: 'used',
        storage: '128GB',
        utm_source: 'google',
      }),
    });

    expect(metadata.alternates?.canonical).toBe(
      'https://teststore.usebaci.com/laptops/hp-laptop-14-ep0063nia'
    );
  });
});
