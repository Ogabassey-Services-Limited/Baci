import { render, screen } from '@testing-library/react';
import { type ReactNode, Suspense } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockNormalizeStorefrontProductVariants,
  mockOgabasseyProductDetailsPage,
  mockProductDetailClient,
} = vi.hoisted(() => ({
  mockNormalizeStorefrontProductVariants: vi.fn<
    (...args: unknown[]) => Record<string, unknown>[]
  >(() => []),
  mockOgabasseyProductDetailsPage: vi.fn<(props: unknown) => void>(),
  mockProductDetailClient: vi.fn<(props: unknown) => null>(() => null),
}));

const mockGetEffectiveStock = vi.fn<(item: unknown) => number>(() => 0);

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
const mockGenerateBreadcrumbSchema = vi.fn((_items: unknown) => ({}));
const mockGenerateProductSchema = vi.fn((..._args: unknown[]) => ({}));

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
  ProductDetailsPage: (props: {
    product: { name: string };
    semanticSections?: ReactNode;
  }) => {
    mockOgabasseyProductDetailsPage(props);
    const { product, semanticSections = null } = props;

    return (
      <>
        <h1>{product.name}</h1>
        {semanticSections}
      </>
    );
  },
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
  getEffectiveStock: (item: unknown) => mockGetEffectiveStock(item),
}));

vi.mock('@/lib/sanitize-core', () => ({
  escapeHtml: (value: string) => value,
}));

vi.mock('@/lib/sanitize-json-ld', () => ({
  safeJsonLdStringify: () => '{}',
}));

vi.mock('@/lib/seo-utils', () => ({
  constructCanonicalUrl: (base: string) => base,
  generateBreadcrumbSchema: (items: unknown) =>
    mockGenerateBreadcrumbSchema(items),
  generateMetaTitle: (title: string, options?: { suffix?: string }) =>
    options?.suffix ? `${title} | ${options.suffix}` : title,
  generateMetaDescription: (description: string, maxLength = 160) => {
    const plainText = description.replace(/<[^>]+>/g, '').trim();
    return plainText.length <= maxLength
      ? plainText
      : `${plainText.slice(0, maxLength - 3)}...`;
  },
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
  getProductUrl: (product: {
    id: string;
    slug?: string;
    category?: string | null;
    categories?: { slug?: string } | null;
    category_slug?: string;
    canonical_url?: string | null;
  }) => {
    if (product.canonical_url) {
      try {
        return new URL(product.canonical_url).pathname;
      } catch {
        // Fall through to route construction for invalid canonical_url values.
      }
    }

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
    headers: Headers
  ) => {
    const customDomain = headers.get('x-custom-domain')?.trim();
    if (customDomain) {
      return `https://${customDomain}`;
    }

    return merchant.custom_domain
      ? `https://${merchant.custom_domain}`
      : `https://${merchant.slug}.usebaci.com`;
  },
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
    default: (props: unknown) => {
      mockProductDetailClient(props);
      return null;
    },
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
    mockGetEffectiveStock.mockReset();
    mockGetEffectiveStock.mockReturnValue(0);
    mockOgabasseyProductDetailsPage.mockReset();
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

  it('returns noindex metadata for legacy archived variant slugs (real HTTP 308 happens during page render)', async () => {
    mockGetCachedLegacyProductRedirectTarget.mockResolvedValue({
      id: 'parent-1',
      name: 'iPhone 13 Pro Max',
      slug: 'iphone-13-pro-max',
      category: 'Phones',
      categories: { id: 'cat-1', name: 'Phones', slug: 'phones' },
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'teststore',
        category: 'smartphones',
        productSlug: 'iphone-13-pro-max-6gb-128gb',
      }),
      searchParams: Promise.resolve({}),
    });

    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    expect(mockGetCachedLegacyProductRedirectTarget).toHaveBeenCalledWith(
      'merchant-1',
      'iphone-13-pro-max-6gb-128gb'
    );
    expect(mockPermanentRedirect).not.toHaveBeenCalled();
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

  it('returns noindex metadata for category-mismatch URLs (real HTTP 308 happens during page render)', async () => {
    mockGetCachedProductWithDetails.mockResolvedValue(
      categorizedDetailedProduct
    );

    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'teststore',
        category: 'hp',
        productSlug: 'hp-laptop-14-ep0063nia',
      }),
      searchParams: Promise.resolve({}),
    });

    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    expect(mockPermanentRedirect).not.toHaveBeenCalled();
  });

  it('returns noindex metadata for mixed-case product slugs (real HTTP 308 happens during page render)', async () => {
    mockGetCachedProductWithDetails
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(categorizedDetailedProduct);

    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'teststore',
        category: 'laptops',
        productSlug: 'HP-LAPTOP-14-EP0063NIA',
      }),
      searchParams: Promise.resolve({}),
    });

    expect(metadata.robots).toMatchObject({ index: false, follow: false });
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
    expect(mockPermanentRedirect).not.toHaveBeenCalled();
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
    mockGenerateBreadcrumbSchema.mockClear();
    mockGetEffectiveStock.mockReset();
    mockGetEffectiveStock.mockReturnValue(0);
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
    mockOgabasseyProductDetailsPage.mockReset();
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

  it('preserves unmanaged stock and variant stock quantities for the Ogabassey PDP', async () => {
    mockNormalizeStorefrontProductVariants.mockReturnValue([
      {
        id: 'variant-128-black',
        attributes: { storage: '128GB', color: 'Black' },
        images: [],
        price_override: 437000,
        sku: 'IPHONE13-128-BLK',
        stock_quantity: 0,
      },
    ]);
    mockGetCachedProductWithDetails.mockResolvedValue({
      ...categorizedDetailedProduct,
      category: 'Smartphones',
      categories: {
        id: 'cat-smartphones',
        name: 'Smartphones',
        parent_id: null,
        slug: 'smartphones',
      },
      manage_stock: false,
      name: 'iPhone 13',
      slug: 'iphone-13',
      stock: 0,
      product_variants: [
        {
          id: 'variant-128-black',
          attributes: { storage: '128GB', color: 'Black' },
          images: [],
          price_override: 437000,
          sku: 'IPHONE13-128-BLK',
          stock_quantity: 0,
        },
      ],
    });

    render(
      await CategoryProductPage({
        params: Promise.resolve({
          slug: 'teststore',
          category: 'smartphones',
          productSlug: 'iphone-13',
        }),
        searchParams: Promise.resolve({}),
      })
    );

    const ogabasseyProps = mockOgabasseyProductDetailsPage.mock.calls
      .at(-1)
      ?.at(0) as
      | {
          product?: {
            manage_stock?: boolean;
            stock?: number;
            variants?: Record<string, unknown>[];
          };
        }
      | undefined;

    expect(ogabasseyProps?.product).toEqual(
      expect.objectContaining({
        manage_stock: false,
        stock: 0,
      })
    );
    expect(ogabasseyProps?.product?.variants?.[0]).toEqual(
      expect.objectContaining({
        stock: 0,
        stock_quantity: 0,
      })
    );
  });

  it('defaults manage_stock to true when the detailed product omits it', async () => {
    // Regression: missing `manage_stock` must default to `true` so legacy
    // rows with `null` are not advertised as `InStock` via
    // `generateProductSchema` regardless of actual stock. See seo-utils
    // `getProductAvailability` — `manage_stock === false` short-circuits to
    // InStock and would mask OutOfStock inventory.
    mockGetRequestScopedMerchant.mockResolvedValue({
      ...baseMerchant,
      template_id: undefined,
    });
    mockGetCachedProductWithDetails.mockResolvedValue({
      ...categorizedDetailedProduct,
      manage_stock: undefined,
    });

    render(
      await CategoryProductPage({
        params: Promise.resolve({
          slug: 'teststore',
          category: 'laptops',
          productSlug: 'hp-laptop-14-ep0063nia',
        }),
        searchParams: Promise.resolve({}),
      })
    );

    const lastProductDetailProps = mockProductDetailClient.mock.calls.at(-1);

    expect(lastProductDetailProps?.[0]).toEqual(
      expect.objectContaining({
        product: expect.objectContaining({
          manage_stock: true,
        }),
      })
    );
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

  it('defaults manage_stock to true when the detailed product has explicit false', async () => {
    // Verify that explicit `manage_stock: false` is preserved (unlimited stock).
    mockGetRequestScopedMerchant.mockResolvedValue({
      ...baseMerchant,
      template_id: undefined,
    });
    mockGetCachedProductWithDetails.mockResolvedValue({
      ...categorizedDetailedProduct,
      manage_stock: false,
    });

    render(
      await CategoryProductPage({
        params: Promise.resolve({
          slug: 'teststore',
          category: 'laptops',
          productSlug: 'hp-laptop-14-ep0063nia',
        }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(mockProductDetailClient.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        product: expect.objectContaining({
          manage_stock: false,
        }),
      })
    );
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
      expect.any(Object),
      'TestStore',
      'NGN',
      'NG',
      null,
      expect.objectContaining({
        supportEmail: 'support@test.example',
        supportPhone: '+2348000000000',
      }),
      {
        productUrl:
          'https://teststore.usebaci.com/smartphones/samsung-galaxy-z-trifold',
      }
    );
  });

  it('keeps JSON-LD and breadcrumbs aligned with the validated canonical URL when stored canonical_url is stale', async () => {
    const expectedCanonicalUrl =
      'https://teststore.usebaci.com/smartphones/samsung-galaxy-z-trifold';
    mockGetCachedProductWithDetails.mockResolvedValue({
      ...categorizedDetailedProduct,
      name: 'Samsung Galaxy Z TriFold',
      slug: 'samsung-galaxy-z-trifold',
      category: 'Smartphones',
      category_slug: 'smartphones',
      categories: {
        id: 'cat-smartphones',
        name: 'Smartphones',
        slug: 'smartphones',
        parent_id: null,
      },
      canonical_url:
        'https://teststore.usebaci.com/products/samsung-galaxy-z-trifold',
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'teststore',
        category: 'smartphones',
        productSlug: 'samsung-galaxy-z-trifold',
      }),
      searchParams: Promise.resolve({}),
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

    expect(metadata.alternates?.canonical).toBe(expectedCanonicalUrl);
    expect(mockGenerateProductSchema).toHaveBeenCalledWith(
      expect.any(Object),
      'TestStore',
      'NGN',
      'NG',
      null,
      expect.any(Object),
      { productUrl: expectedCanonicalUrl }
    );
    expect(mockGenerateBreadcrumbSchema).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Samsung Galaxy Z TriFold',
          url: expectedCanonicalUrl,
        }),
      ])
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

  it('normalizes canonical_url host to the request-scoped storefront domain', async () => {
    mockGetRequestScopedMerchant.mockResolvedValueOnce({
      ...baseMerchant,
      custom_domain: 'ogabassey.com',
    });
    mockGetCachedProductWithDetails.mockResolvedValue({
      ...categorizedDetailedProduct,
      canonical_url: 'https://usebaci.com/laptops/hp-laptop-14-ep0063nia',
    });
    mockHeaders.mockResolvedValue(
      new Headers([['x-custom-domain', 'ogabassey.com']])
    );

    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'teststore',
        category: 'laptops',
        productSlug: 'hp-laptop-14-ep0063nia',
      }),
      searchParams: Promise.resolve({}),
    });

    expect(metadata.alternates?.canonical).toBe(
      'https://ogabassey.com/laptops/hp-laptop-14-ep0063nia'
    );
  });
});
