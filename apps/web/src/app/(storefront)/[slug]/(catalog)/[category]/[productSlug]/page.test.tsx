import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, waitFor } from '@testing-library/react';
import { type ReactNode, Suspense } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OGABASSEY_TEMPLATE_ID } from '@/config/templates';

const {
  mockNormalizeStorefrontProductVariants,
  mockOgabasseyPdpProductResourceHints,
  mockOgabasseyPdpSemanticSections,
  mockOgabasseyPdpStaticResourceHints,
  mockOgabasseyProductDetailsPage,
  mockPreloadOgabasseyPdpProductImage,
  mockProductDetailClient,
} = vi.hoisted(() => ({
  mockNormalizeStorefrontProductVariants: vi.fn<
    (...args: unknown[]) => Record<string, unknown>[]
  >(() => []),
  mockOgabasseyPdpProductResourceHints: vi.fn<
    (props: { src: string | null | undefined }) => null
  >(() => null),
  mockOgabasseyPdpSemanticSections: vi.fn<(props: unknown) => void>(),
  mockOgabasseyPdpStaticResourceHints: vi.fn<() => void>(),
  mockOgabasseyProductDetailsPage: vi.fn<(props: unknown) => void>(),
  mockPreloadOgabasseyPdpProductImage:
    vi.fn<(props: { src: string | null | undefined }) => void>(),
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

vi.mock(
  '@/app/(storefront)/ogabassey/ogabassey-pdp-static-resource-hints',
  () => ({
    OgabasseyPdpStaticResourceHints: () => {
      mockOgabasseyPdpStaticResourceHints();
      return null;
    },
  })
);

vi.mock(
  '@/app/(storefront)/ogabassey/ogabassey-pdp-product-resource-hints',
  () => ({
    OgabasseyPdpProductResourceHints: (props: {
      src: string | null | undefined;
    }) => mockOgabasseyPdpProductResourceHints(props),
    preloadOgabasseyPdpProductImage: (props: {
      src: string | null | undefined;
    }) => mockPreloadOgabasseyPdpProductImage(props),
  })
);

vi.mock('./ogabassey-pdp-semantic-sections', () => ({
  OgabasseyPdpSemanticSections: (props: unknown) => {
    mockOgabasseyPdpSemanticSections(props);
    return <section data-testid="ogabassey-pdp-semantic-sections" />;
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

vi.mock('@/app/(storefront)/[slug]/storefront-dynamic-metadata-marker', () => ({
  StorefrontDynamicMetadataMarker: () => (
    <div aria-label="dynamic metadata marker" role="status" />
  ),
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

type MockProductUrlInput = {
  id: string;
  slug?: string;
  category?: string | null;
  categories?: { slug?: string } | null;
  category_slug?: string;
  canonical_url?: string | null;
};

function getMockProductUrl(product: MockProductUrlInput) {
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
}

function getMockValidatedProductUrl(
  product: MockProductUrlInput,
  baseUrl: string
) {
  const finalProductPath = getMockProductUrl({
    ...product,
    canonical_url: null,
  });
  if (product.canonical_url) {
    try {
      const parsedCanonicalUrl = new URL(product.canonical_url, baseUrl);
      const canonicalPath =
        parsedCanonicalUrl.pathname.replace(/\/+$/, '') || '/';
      const normalizedFinalPath = finalProductPath.replace(/\/+$/, '') || '/';
      if (
        !parsedCanonicalUrl.search &&
        !parsedCanonicalUrl.hash &&
        canonicalPath === normalizedFinalPath
      ) {
        return `${new URL(baseUrl).origin}${parsedCanonicalUrl.pathname}`;
      }
    } catch {
      // Fall through to the deterministic path below.
    }
  }

  return `${baseUrl}${finalProductPath}`;
}

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
  getProductUrl: (product: MockProductUrlInput) => getMockProductUrl(product),
  getValidatedProductUrl: (product: MockProductUrlInput, baseUrl: string) =>
    getMockValidatedProductUrl(product, baseUrl),
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

vi.mock('./default-product-detail-client', () => ({
  DefaultProductDetailClient: (props: unknown) => {
    mockProductDetailClient(props);
    return null;
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
    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    try {
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
    } finally {
      consoleWarnSpy.mockRestore();
    }

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
      meta_description:
        '<p>A <strong>premium</strong> laptop built for creators.</p>',
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

  it('targets device price in Nigeria when custom metadata is absent', async () => {
    mockNormalizeStorefrontProductVariants.mockReturnValue([
      {
        id: 'iphone13-128',
        attributes: { storage: '128GB' },
        price_override: 390000,
        stock_quantity: 5,
      },
      {
        id: 'iphone13-256',
        attributes: { storage: '256GB' },
        price_override: 520000,
        stock_quantity: 5,
      },
    ]);
    mockGetCachedProductWithDetails.mockResolvedValue({
      ...categorizedDetailedProduct,
      name: 'iPhone 13',
      slug: 'iphone-13',
      description: 'Apple iPhone 13 with A15 Bionic.',
      price: 430000,
      category: 'Smartphones',
      categories: {
        id: 'cat-smartphones',
        name: 'Smartphones',
        slug: 'smartphones',
        parent_id: null,
      },
      product_variants: [
        { id: 'iphone13-128', price_override: 390000 },
        { id: 'iphone13-256', price_override: 520000 },
      ],
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'teststore',
        category: 'smartphones',
        productSlug: 'iphone-13',
      }),
      searchParams: Promise.resolve({}),
    });

    expect(metadata.title).toBe('iPhone 13 Price in Nigeria | TestStore');
    expect(metadata.description).toContain(
      'iPhone 13 price in Nigeria starts from ₦390,000 on TestStore'
    );
    expect(metadata.other).toMatchObject({
      'product:price:amount': '390000',
      'product:price:currency': 'NGN',
    });
  });

  it('omits Nigeria price copy for non-Nigerian storefront metadata', async () => {
    mockGetRequestScopedMerchant.mockResolvedValueOnce({
      ...baseMerchant,
      country: 'GH',
      payout_currency: 'GHS',
    });
    mockGetCachedProductWithDetails.mockResolvedValue({
      ...categorizedDetailedProduct,
      name: 'Pixel 10',
      slug: 'pixel-10',
      description: 'Google Pixel phone.',
      price: 999,
      category: 'Smartphones',
      categories: {
        id: 'cat-smartphones',
        name: 'Smartphones',
        slug: 'smartphones',
        parent_id: null,
      },
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'teststore',
        category: 'smartphones',
        productSlug: 'pixel-10',
      }),
      searchParams: Promise.resolve({}),
    });

    expect(metadata.title).toBe('Pixel 10 Price | TestStore');
    expect(metadata.description).toContain('Pixel 10 price is');
    expect(metadata.description).not.toContain('in Nigeria');
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
      template_id: OGABASSEY_TEMPLATE_ID,
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
    mockOgabasseyPdpProductResourceHints.mockReset();
    mockOgabasseyPdpProductResourceHints.mockReturnValue(null);
    mockOgabasseyPdpSemanticSections.mockReset();
    mockOgabasseyPdpStaticResourceHints.mockReset();
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
    expect(
      screen.getByRole('status', { name: /dynamic metadata marker/i })
    ).toBeInTheDocument();
    expect(container.querySelectorAll('h1')).toHaveLength(1);
  });

  it('mounts the OgaBassey PDP preload hints for the OgaBassey template branch', async () => {
    mockGetCachedProductWithDetails.mockResolvedValueOnce({
      ...categorizedDetailedProduct,
      images: ['https://cdn.ogabassey.com/core-assets/products/hp-laptop.avif'],
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

    expect(mockOgabasseyPdpStaticResourceHints).toHaveBeenCalledTimes(1);
    expect(mockPreloadOgabasseyPdpProductImage).toHaveBeenCalledWith({
      src: 'https://cdn.ogabassey.com/core-assets/products/hp-laptop.avif',
    });
    expect(mockOgabasseyPdpProductResourceHints).toHaveBeenCalledWith({
      src: 'https://cdn.ogabassey.com/core-assets/products/hp-laptop.avif',
    });
  });

  it('renders the OgaBassey product shell before supplemental PDP data resolves', async () => {
    let resolveCategoryPageData:
      | ((
          value: Awaited<ReturnType<typeof mockGetCachedCategoryPageData>>
        ) => void)
      | undefined;
    mockGetCachedCategoryPageData.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveCategoryPageData = resolve;
      })
    );
    mockGetCachedProductWithDetails.mockResolvedValueOnce({
      ...categorizedDetailedProduct,
      images: [
        'https://cdn.ogabassey.com/core-assets/products/lenovo-legion.avif',
      ],
    });

    const pagePromise = CategoryProductPage({
      params: Promise.resolve({
        slug: 'teststore',
        category: 'laptops',
        productSlug: 'hp-laptop-14-ep0063nia',
      }),
      searchParams: Promise.resolve({}),
    });
    let pageUi: Awaited<ReturnType<typeof CategoryProductPage>> | undefined;
    pagePromise.then((result) => {
      pageUi = result;
    });

    await waitFor(() => {
      expect(pageUi).toBeDefined();
    });

    render(pageUi as ReactNode);
    expect(mockPreloadOgabasseyPdpProductImage).toHaveBeenCalledWith({
      src: 'https://cdn.ogabassey.com/core-assets/products/lenovo-legion.avif',
    });
    expect(mockOgabasseyPdpProductResourceHints).toHaveBeenCalledWith({
      src: 'https://cdn.ogabassey.com/core-assets/products/lenovo-legion.avif',
    });
    expect(mockOgabasseyProductDetailsPage).toHaveBeenCalledWith(
      expect.objectContaining({
        product: expect.objectContaining({
          image:
            'https://cdn.ogabassey.com/core-assets/products/lenovo-legion.avif',
        }),
      })
    );

    resolveCategoryPageData?.(null);
  });

  it('does not mount OgaBassey PDP preload hints for generic template product pages', async () => {
    mockGetRequestScopedMerchant.mockResolvedValue({
      ...baseMerchant,
      template_id: `${OGABASSEY_TEMPLATE_ID}_other`,
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

    expect(mockOgabasseyPdpStaticResourceHints).not.toHaveBeenCalled();
    expect(mockPreloadOgabasseyPdpProductImage).not.toHaveBeenCalled();
    expect(mockOgabasseyPdpProductResourceHints).not.toHaveBeenCalled();
  });

  it('keeps the generic product client behind the default branch loader', () => {
    const routeSource = readFileSync(
      join(
        process.cwd(),
        'src/app/(storefront)/[slug]/(catalog)/[category]/[productSlug]/page.tsx'
      ),
      { encoding: 'utf8' }
    );

    expect(routeSource).not.toContain(
      "import ProductDetailClient from '@/app/(storefront)/[slug]/(catalog)/products/[productSlug]/product-detail-client'"
    );
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

    // Deliberately render the page only to drive JSON-LD/breadcrumb side effects.
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

  it('preserves SKU-matrix variant conditions for the Ogabassey PDP', async () => {
    mockNormalizeStorefrontProductVariants.mockReturnValue([
      {
        id: 'iphone15-used-esim',
        condition: 'used',
        attributes: {
          storage: '128GB',
          color: 'Black',
          sim_type: 'eSIM Only',
        },
        images: [],
        price_override: 829000,
        sku: 'IPHONE15-USED-128-BLK-ESIM',
        stock_quantity: 3,
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
      has_variants: true,
      name: 'iPhone 15',
      product_variants: [
        {
          id: 'iphone15-used-esim',
          attributes: {
            storage: '128GB',
            color: 'Black',
            sim_type: 'eSIM Only',
          },
          condition: 'used',
          images: [],
          price_override: 829000,
          sku: 'IPHONE15-USED-128-BLK-ESIM',
          stock_quantity: 3,
        },
      ],
      slug: 'iphone-15',
      variant_model: 'sku_matrix',
    });

    render(
      await CategoryProductPage({
        params: Promise.resolve({
          slug: 'teststore',
          category: 'smartphones',
          productSlug: 'iphone-15',
        }),
        searchParams: Promise.resolve({}),
      })
    );

    const ogabasseyProps = mockOgabasseyProductDetailsPage.mock.calls
      .at(-1)
      ?.at(0) as
      | {
          product?: {
            variants?: Record<string, unknown>[];
          };
        }
      | undefined;

    expect(ogabasseyProps?.product?.variants?.[0]).toEqual(
      expect.objectContaining({
        attributes: expect.objectContaining({
          sim_type: 'eSIM Only',
          storage: '128GB',
        }),
        condition: 'used',
        id: 'iphone15-used-esim',
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

    // Deliberately render the page only to drive JSON-LD/breadcrumb side effects.
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

    expect(mockOgabasseyPdpSemanticSections).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryName: 'Smartphones',
        storeUrl: 'https://teststore.usebaci.com',
        categorySlug: 'smartphones',
        product: expect.objectContaining({
          slug: 'samsung-galaxy-z-trifold',
        }),
        trustBullets: expect.arrayContaining([
          'The Samsung Galaxy Z TriFold price in Nigeria on TestStore is ₦645,600. Check specs, condition, warranty, delivery, and payment options before you buy.',
          'Free returns within 7 days',
          'Ships across Nigeria',
          'WhatsApp support available',
        ]),
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

  it('does not reuse stored canonical_url query strings or fragments in JSON-LD and breadcrumbs', async () => {
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
      canonical_url: `${expectedCanonicalUrl}?utm_source=google#reviews`,
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
