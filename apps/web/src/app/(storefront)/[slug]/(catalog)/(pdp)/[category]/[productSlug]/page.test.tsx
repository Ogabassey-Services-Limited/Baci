import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, waitFor } from '@testing-library/react';
import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  Suspense,
} from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OGABASSEY_TEMPLATE_ID } from '@/config/templates';

vi.mock('server-only', () => ({}));

const {
  mockNormalizeStorefrontProductVariants,
  mockOgabasseyPdpProductResourceHints,
  mockOgabasseyPdpSemanticSections,
  mockOgabasseyPdpStaticResourceHints,
  mockOgabasseyPdpCriticalCommerce,
  mockOgabasseyPdpDeferredDetailIsland,
  mockOgabasseyProductDetailsPage,
  mockConnection,
  mockStorefrontDynamicMetadataMarker,
  mockGetStorefrontShellSnapshotBase,
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
  mockOgabasseyPdpCriticalCommerce: vi.fn<(props: unknown) => void>(),
  mockOgabasseyPdpDeferredDetailIsland: vi.fn<(props: unknown) => void>(),
  mockOgabasseyProductDetailsPage: vi.fn<(props: unknown) => void>(),
  mockConnection: vi.fn<() => Promise<void>>(() => Promise.resolve()),
  mockStorefrontDynamicMetadataMarker: vi.fn(),
  mockGetStorefrontShellSnapshotBase:
    vi.fn<(...args: unknown[]) => Promise<unknown>>(),
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
const mockGetCachedProduct = vi.fn();
const mockGetCachedProductLcpHint = vi.fn();
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

vi.mock('next/server', () => ({
  connection: () => mockConnection(),
}));

vi.mock('@/app/(storefront)/[slug]/storefront-dynamic-metadata-marker', () => ({
  StorefrontDynamicMetadataMarker: () => {
    mockStorefrontDynamicMetadataMarker();
    return <div aria-label="dynamic metadata marker" role="status" />;
  },
}));

vi.mock('next/image', () => ({
  default: ({
    alt,
    fetchPriority,
    src,
  }: {
    alt: string;
    fetchPriority?: string;
    src: string;
  }) => (
    // biome-ignore lint/performance/noImgElement: next/image test double exposes rendered attributes
    <img alt={alt} data-fetch-priority={fetchPriority} src={src} />
  ),
  getImageProps: ({
    alt,
    className,
    decoding,
    fetchPriority,
    fill,
    loader,
    priority,
    quality,
    sizes,
    src,
  }: {
    alt: string;
    className?: string;
    decoding?: string;
    fetchPriority?: string;
    fill?: boolean;
    loader?: () => string;
    priority?: boolean;
    quality?: number;
    sizes?: string;
    src: string;
  }) => ({
    props: {
      alt,
      className,
      decoding,
      fetchPriority,
      fill,
      loader,
      priority,
      quality,
      sizes,
      src,
      srcSet: `${src} 640w`,
    },
  }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/app/(storefront)/[slug]/storefront-shell-snapshot', () => ({
  getStorefrontShellSnapshotBase: (...args: unknown[]) =>
    mockGetStorefrontShellSnapshotBase(...args),
}));

vi.mock('@/components/storefront/ogabassey/pages/product-details-page', () => ({
  ProductDetailsPage: (props: {
    mode?: 'full' | 'commerce' | 'belowFold';
    product: { image?: string; name: string };
    semanticSections?: ReactNode;
  }) => {
    mockOgabasseyProductDetailsPage(props);
    const { mode = 'full', product, semanticSections = null } = props;

    if (mode === 'commerce') {
      return (
        <div data-testid="ogabassey-commerce-island">
          <button type="button">Mock Add to Cart</button>
        </div>
      );
    }

    if (mode === 'belowFold') {
      return (
        <div data-testid="ogabassey-below-fold-island">{semanticSections}</div>
      );
    }

    return (
      <>
        <h1>{product.name}</h1>
        {product.image ? (
          // biome-ignore lint/performance/noImgElement: test mock for duplicate image detection
          <img alt={product.name} src={product.image} />
        ) : null}
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

vi.mock('@/components/storefront/ogabassey/pdp/critical-commerce', () => ({
  OgabasseyPdpCriticalCommerce: (props: unknown) => {
    mockOgabasseyPdpCriticalCommerce(props);
    return (
      <aside aria-label="Purchase options">
        <button type="button">Mock Add to Cart</button>
      </aside>
    );
  },
}));

vi.mock('@/components/storefront/ogabassey/pdp/client-islands', () => ({
  OgabasseyPdpBelowFoldIsland: (props: {
    product: unknown;
    semanticSections?: ReactNode;
  }) => {
    mockOgabasseyPdpDeferredDetailIsland(props);
    return (
      <section aria-label="Product details">{props.semanticSections}</section>
    );
  },
}));

vi.mock('@/lib/cached-data', () => ({
  getRequestScopedMerchant: (...args: unknown[]) =>
    mockGetRequestScopedMerchant(...args),
  getCachedLegacyProductRedirectTarget: (...args: unknown[]) =>
    mockGetCachedLegacyProductRedirectTarget(...args),
  getCachedProduct: (...args: unknown[]) => mockGetCachedProduct(...args),
  getCachedProductLcpHint: (...args: unknown[]) =>
    mockGetCachedProductLcpHint(...args),
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
  stripHtmlTags: (value: string | null | undefined) =>
    value?.replace(/<[^>]+>/g, '') || '',
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
  '@/app/(storefront)/[slug]/(catalog)/(pdp)/products/[productSlug]/product-detail-client',
  () => ({
    default: (props: unknown) => {
      mockProductDetailClient(props);
      return null;
    },
  })
);

import CategoryProductPage, { generateMetadata } from './page';

type ResolveRscOptions = {
  stripSuspense?: boolean;
  skipContent?: boolean;
};

type ResolveRscValue = PromiseLike<ReactNode> | ReactNode;

type ResolveRscElementProps = Record<string, unknown> & {
  children?: ResolveRscValue;
};

type ServerComponent = (
  props: ResolveRscElementProps
) => PromiseLike<ReactNode> | ReactNode;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return isRecord(value) && typeof value.then === 'function';
}

function isRscElement(
  value: ResolveRscValue
): value is ReactElement<ResolveRscElementProps> {
  return isRecord(value) && isValidElement<ResolveRscElementProps>(value);
}

function isServerComponent(type: unknown): type is ServerComponent {
  return typeof type === 'function';
}

function isDeferredCategoryProductContent(
  type: unknown,
  props: ResolveRscElementProps
) {
  return (
    isServerComponent(type) &&
    typeof props.slug === 'string' &&
    isPromiseLike(props.searchParams) &&
    isPromiseLike(props.productResultPromise)
  );
}

function isExpectedRscInterruption(error: unknown) {
  if (isPromiseLike(error)) return true;
  if (!(error instanceof Error)) return false;

  const digest = isRecord(error) ? error.digest : undefined;
  const message = `${error.message} ${
    typeof digest === 'string' ? digest : ''
  }`;
  return (
    message.includes('NEXT_REDIRECT') || message.includes('NEXT_NOT_FOUND')
  );
}

async function resolveRsc(
  element: ResolveRscValue,
  options: ResolveRscOptions = {}
): Promise<ReactNode> {
  if (!element) return element;

  if (Array.isArray(element)) {
    return Promise.all(element.map((item) => resolveRsc(item, options)));
  }

  if (isPromiseLike(element)) {
    const resolvedValue = await element;
    return resolveRsc(resolvedValue as ResolveRscValue, options);
  }

  if (isRscElement(element)) {
    const { type, props } = element;

    if (options.stripSuspense && type === Suspense) {
      return resolveRsc(props.children, options);
    }

    if (isDeferredCategoryProductContent(type, props)) {
      if (options.skipContent) {
        return element;
      }
    }

    if (isServerComponent(type)) {
      try {
        const resolved = await type(props);
        return resolveRsc(resolved, options);
      } catch (error) {
        if (!isExpectedRscInterruption(error)) {
          console.error('Unexpected RSC test helper error:', error);
        }
        return element;
      }
    }

    if ('children' in props) {
      const resolvedChildren = await resolveRsc(props.children, options);
      return cloneElement(element, {}, resolvedChildren);
    }
  }

  return element;
}

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

type LegacyProductFixture = Omit<
  typeof categorizedDetailedProduct,
  'images' | 'price'
> & {
  images?: string[];
  price: number | string;
  specifications?: unknown;
  product_key_specs?: unknown;
};

function toLegacyCachedProduct(
  product: LegacyProductFixture = categorizedDetailedProduct
) {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    status: product.status,
    slug: product.slug,
    canonical_url: null,
    brand: product.brand,
    category: product.category,
    condition: product.condition,
    manage_stock: product.manage_stock,
    price: product.price,
    schema_markup: null,
    stock_quantity: product.stock_quantity ?? product.stock,
    base_price:
      typeof product.price === 'string'
        ? Number.parseFloat(product.price)
        : product.price,
    sale_price: null,
    min_variant_price: null,
    max_variant_price: null,
    track_quantity: product.manage_stock,
    quantity: product.stock_quantity ?? product.stock,
    images: product.images,
    product_variants: product.product_variants,
    offers: product.product_offers,
    product_categories: [
      {
        categories: product.categories,
      },
    ],
    specifications: product.specifications ?? null,
    product_key_specs: product.product_key_specs ?? null,
  };
}

function mockDefaultCachedProductLookup() {
  mockGetCachedProduct.mockImplementation((_merchantId, productSlug) =>
    Promise.resolve(
      productSlug === categorizedDetailedProduct.slug
        ? toLegacyCachedProduct()
        : null
    )
  );
}

function mockDefaultCachedProductLcpHintLookup() {
  mockGetCachedProductLcpHint.mockImplementation((_merchantId, productSlug) =>
    Promise.resolve(
      productSlug === categorizedDetailedProduct.slug
        ? toLegacyCachedProduct()
        : null
    )
  );
}

describe('[category]/[productSlug] page metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetEffectiveStock.mockReset();
    mockGetEffectiveStock.mockReturnValue(0);
    mockOgabasseyPdpCriticalCommerce.mockReset();
    mockOgabasseyPdpDeferredDetailIsland.mockReset();
    mockOgabasseyProductDetailsPage.mockReset();
    mockProductDetailClient.mockReset();
    mockProductDetailClient.mockReturnValue(null);
    mockGenerateProductSchema.mockReset();
    mockHeaders.mockReset();
    mockHeaders.mockResolvedValue(new Headers());
    mockNormalizeStorefrontProductVariants.mockReset();
    mockNormalizeStorefrontProductVariants.mockReturnValue([]);
    mockGetRequestScopedMerchant.mockResolvedValue(baseMerchant);
    mockGetCachedProduct.mockReset();
    mockDefaultCachedProductLookup();
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

  it('throws notFound from metadata when the product is missing and no legacy redirect exists', async () => {
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

    expect(mockNotFound).toHaveBeenCalledTimes(1);
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

  it('leaves variant query redirects to page rendering, not metadata generation', async () => {
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

    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'teststore',
        category: 'laptops',
        productSlug: 'hp-laptop-14-ep0063nia',
      }),
      searchParams: Promise.resolve({
        storage: '128GB',
        utm_source: 'google',
      }),
    });

    expect(metadata.alternates?.canonical).toBe(
      'https://teststore.usebaci.com/laptops/hp-laptop-14-ep0063nia'
    );
    expect(mockPermanentRedirect).not.toHaveBeenCalled();
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
    mockGetStorefrontShellSnapshotBase.mockReset();
    mockGetStorefrontShellSnapshotBase.mockResolvedValue({
      merchant: {
        ...baseMerchant,
        template_id: OGABASSEY_TEMPLATE_ID,
      },
      routingMode: 'path',
      basePath: '/teststore',
    });
    mockGetRequestScopedMerchant.mockResolvedValue({
      ...baseMerchant,
      template_id: OGABASSEY_TEMPLATE_ID,
    });
    mockGetCachedProduct.mockReset();
    mockDefaultCachedProductLookup();
    mockGetCachedProductLcpHint.mockReset();
    mockDefaultCachedProductLcpHintLookup();
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
    mockOgabasseyPdpCriticalCommerce.mockReset();
    mockOgabasseyPdpDeferredDetailIsland.mockReset();
    mockOgabasseyProductDetailsPage.mockReset();
    mockStorefrontDynamicMetadataMarker.mockReset();
    mockBuildProductSemanticModel.mockReturnValue({
      trustBullets: [],
      supportLinks: [],
      guideLinks: [],
      alternatives: null,
      sameBrand: null,
      samePrice: null,
    });
  });

  it('marks product metadata as request-time rendered', async () => {
    await generateMetadata({
      params: Promise.resolve({
        slug: 'teststore',
        category: 'laptops',
        productSlug: 'hp-laptop-14-ep0063nia',
      }),
      searchParams: Promise.resolve({}),
    });

    expect(mockConnection).toHaveBeenCalledOnce();
  });

  it('renders the PDP shell after opting the page into request-time rendering', async () => {
    const ui = await resolveRsc(
      await CategoryProductPage({
        params: Promise.resolve({
          slug: 'teststore',
          category: 'laptops',
          productSlug: 'hp-laptop-14-ep0063nia',
        }),
        searchParams: Promise.resolve({}),
      })
    );
    const { container } = render(ui);
    const criticalShell = container.querySelector(
      '[data-ogabassey-pdp-critical-shell]'
    );

    if (!criticalShell) {
      throw new Error('Expected the OgaBassey PDP critical shell to render');
    }

    expect(mockConnection).toHaveBeenCalledOnce();
    expect(mockStorefrontDynamicMetadataMarker).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('status', { name: /dynamic metadata marker/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'HP Laptop 14-ep0063nia',
      })
    ).toBeInTheDocument();
    expect(container.querySelectorAll('h1')).toHaveLength(1);
  });

  it('prefers the direct canonical category over additional product collections', async () => {
    mockGetCachedProductLcpHint.mockResolvedValueOnce({
      ...toLegacyCachedProduct(),
      categories: categorizedDetailedProduct.categories,
      product_categories: [
        {
          categories: { id: 'collection-hp', name: 'HP', slug: 'hp' },
        },
      ],
    });

    const ui = await resolveRsc(
      await CategoryProductPage({
        params: Promise.resolve({
          slug: 'teststore',
          category: 'laptops',
          productSlug: 'hp-laptop-14-ep0063nia',
        }),
        searchParams: Promise.resolve({}),
      })
    );

    render(ui);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'HP Laptop 14-ep0063nia',
      })
    ).toBeInTheDocument();
    expect(mockPermanentRedirect).not.toHaveBeenCalled();
  });

  it('renders one visible OgaBassey PDP h1 after the critical shell split', async () => {
    const ui = await resolveRsc(
      await CategoryProductPage({
        params: Promise.resolve({
          slug: 'teststore',
          category: 'laptops',
          productSlug: 'hp-laptop-14-ep0063nia',
        }),
        searchParams: Promise.resolve({}),
      })
    );

    const { container } = render(ui);
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'HP Laptop 14-ep0063nia',
      })
    ).toBeInTheDocument();
  });

  it('splits OgaBassey client work into critical commerce and deferred detail islands', async () => {
    const { container } = render(
      await resolveRsc(
        await CategoryProductPage({
          params: Promise.resolve({
            slug: 'teststore',
            category: 'laptops',
            productSlug: 'hp-laptop-14-ep0063nia',
          }),
          searchParams: Promise.resolve({}),
        })
      )
    );

    expect(mockOgabasseyPdpCriticalCommerce).toHaveBeenCalledWith(
      expect.objectContaining({
        cartHref: '/teststore/cart',
        cartProduct: expect.objectContaining({
          name: 'HP Laptop 14-ep0063nia',
        }),
        product: expect.objectContaining({
          name: 'HP Laptop 14-ep0063nia',
        }),
      })
    );
    expect(mockOgabasseyPdpDeferredDetailIsland).toHaveBeenCalledWith(
      expect.objectContaining({
        product: expect.objectContaining({
          name: 'HP Laptop 14-ep0063nia',
        }),
        semanticSections: expect.anything(),
      })
    );
    expect(
      screen.getByRole('complementary', { name: /purchase options/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: /product details/i })
    ).toBeInTheDocument();
    expect(mockOgabasseyProductDetailsPage).not.toHaveBeenCalled();
    expect(
      container.querySelectorAll('img[alt="HP Laptop 14-ep0063nia"]')
    ).toHaveLength(1);
  });

  it('keeps critical PDP links root-relative for domain-routed storefront requests', async () => {
    mockGetStorefrontShellSnapshotBase.mockResolvedValueOnce({
      merchant: {
        ...baseMerchant,
        template_id: OGABASSEY_TEMPLATE_ID,
      },
      routingMode: 'domain',
      basePath: '',
    });

    render(
      await resolveRsc(
        await CategoryProductPage({
          params: Promise.resolve({
            slug: 'teststore',
            category: 'laptops',
            productSlug: 'hp-laptop-14-ep0063nia',
          }),
          searchParams: Promise.resolve({}),
        })
      )
    );

    expect(mockGetStorefrontShellSnapshotBase).toHaveBeenCalledWith(
      'teststore'
    );
    expect(mockOgabasseyPdpCriticalCommerce).toHaveBeenCalledWith(
      expect.objectContaining({
        cartHref: '/cart',
      })
    );
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute(
      'href',
      '/'
    );
    expect(screen.getByRole('link', { name: 'Laptops' })).toHaveAttribute(
      'href',
      '/laptops'
    );
  });

  it('falls back to the slug base path when the shell snapshot base path is malformed', async () => {
    mockGetStorefrontShellSnapshotBase.mockResolvedValueOnce({
      merchant: {
        ...baseMerchant,
        template_id: OGABASSEY_TEMPLATE_ID,
      },
      routingMode: 'path',
      basePath: 'teststore',
    });

    render(
      await resolveRsc(
        await CategoryProductPage({
          params: Promise.resolve({
            slug: 'teststore',
            category: 'laptops',
            productSlug: 'hp-laptop-14-ep0063nia',
          }),
          searchParams: Promise.resolve({}),
        })
      )
    );

    expect(mockOgabasseyPdpCriticalCommerce).toHaveBeenCalledWith(
      expect.objectContaining({
        cartHref: '/teststore/cart',
      })
    );
  });

  it('keeps JSON-LD and hidden summary outside the critical commerce slot', async () => {
    const { container } = render(
      await resolveRsc(
        await CategoryProductPage({
          params: Promise.resolve({
            slug: 'teststore',
            category: 'laptops',
            productSlug: 'hp-laptop-14-ep0063nia',
          }),
          searchParams: Promise.resolve({}),
        })
      )
    );

    const commerceSlot = container.querySelector(
      '[data-ogabassey-pdp-commerce-slot]'
    );

    expect(commerceSlot).not.toBeNull();
    expect(
      commerceSlot?.querySelector('script[type="application/ld+json"]')
    ).toBeNull();
    expect(
      commerceSlot?.querySelector(
        'article[aria-label="HP Laptop 14-ep0063nia summary"]'
      )
    ).toBeNull();
    expect(
      container.querySelector('script[type="application/ld+json"]')
    ).not.toBeNull();
    expect(
      screen.getByLabelText('HP Laptop 14-ep0063nia summary')
    ).toBeInTheDocument();
  });

  it('keeps visible OgaBassey product identity aligned with Product JSON-LD input', async () => {
    render(
      await resolveRsc(
        await CategoryProductPage({
          params: Promise.resolve({
            slug: 'teststore',
            category: 'laptops',
            productSlug: 'hp-laptop-14-ep0063nia',
          }),
          searchParams: Promise.resolve({}),
        })
      )
    );

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'HP Laptop 14-ep0063nia',
      })
    ).toBeInTheDocument();
    expect(mockGenerateProductSchema).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'HP Laptop 14-ep0063nia',
        price: 645_600,
        category: 'Laptops',
      }),
      'TestStore',
      'NGN',
      'NG',
      null,
      expect.any(Object),
      expect.any(Object)
    );
  });

  it('renders the dynamic metadata marker before notFound when the product is missing', async () => {
    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    mockGetCachedProductWithDetails.mockResolvedValueOnce(null);
    mockGetCachedLegacyProductRedirectTarget.mockResolvedValueOnce(null);

    try {
      const page = await CategoryProductPage({
        params: Promise.resolve({
          slug: 'teststore',
          category: 'laptops',
          productSlug: 'missing-product',
        }),
        searchParams: Promise.resolve({}),
      });

      expect(() => render(page as ReactElement)).toThrow('NEXT_NOT_FOUND');

      expect(mockGetCachedLegacyProductRedirectTarget).toHaveBeenCalledWith(
        baseMerchant.id,
        'missing-product'
      );
      expect(mockStorefrontDynamicMetadataMarker).toHaveBeenCalled();
      expect(mockNotFound).toHaveBeenCalled();
      expect(
        mockStorefrontDynamicMetadataMarker.mock.invocationCallOrder[0]
      ).toBeLessThan(mockNotFound.mock.invocationCallOrder[0]);
      expect(consoleWarnSpy).not.toHaveBeenCalledWith(
        'Product not found for storefront product route:',
        'missing-product'
      );
    } finally {
      consoleWarnSpy.mockRestore();
    }
  });

  it('uses the same NGN fallback currency for metadata and product JSON-LD', async () => {
    mockGetRequestScopedMerchant.mockResolvedValue({
      ...baseMerchant,
      payout_currency: null,
      template_id: OGABASSEY_TEMPLATE_ID,
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({
        slug: 'teststore',
        category: 'laptops',
        productSlug: 'hp-laptop-14-ep0063nia',
      }),
      searchParams: Promise.resolve({}),
    });

    await resolveRsc(
      await CategoryProductPage({
        params: Promise.resolve({
          slug: 'teststore',
          category: 'laptops',
          productSlug: 'hp-laptop-14-ep0063nia',
        }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(metadata.other).toMatchObject({
      'product:price:currency': 'NGN',
    });
    expect(mockGenerateProductSchema).toHaveBeenCalledWith(
      expect.any(Object),
      'TestStore',
      'NGN',
      'NG',
      null,
      expect.any(Object),
      expect.any(Object)
    );
  });

  it('strips HTML tags from hidden summary description text', async () => {
    mockGetCachedProductWithDetails.mockResolvedValueOnce({
      ...categorizedDetailedProduct,
      description:
        '<p>A <strong>premium</strong> laptop built for creators.</p>',
    });

    render(
      await resolveRsc(
        await CategoryProductPage({
          params: Promise.resolve({
            slug: 'teststore',
            category: 'laptops',
            productSlug: 'hp-laptop-14-ep0063nia',
          }),
          searchParams: Promise.resolve({}),
        })
      )
    );

    expect(
      screen.getByText('A premium laptop built for creators.')
    ).toBeInTheDocument();
    expect(screen.queryByText(/<strong>/)).not.toBeInTheDocument();
  });

  it('mounts the OgaBassey PDP preload hints for the OgaBassey template branch', async () => {
    const productImage =
      'https://cdn.ogabassey.com/core-assets/products/hp-laptop.avif';
    mockGetCachedProductLcpHint.mockResolvedValueOnce(
      toLegacyCachedProduct({
        ...categorizedDetailedProduct,
        images: [productImage],
      })
    );
    mockGetCachedProductWithDetails.mockResolvedValueOnce({
      ...categorizedDetailedProduct,
      images: [productImage],
    });

    render(
      await resolveRsc(
        await CategoryProductPage({
          params: Promise.resolve({
            slug: 'teststore',
            category: 'laptops',
            productSlug: 'hp-laptop-14-ep0063nia',
          }),
          searchParams: Promise.resolve({}),
        })
      )
    );

    expect(mockOgabasseyPdpStaticResourceHints).toHaveBeenCalledTimes(1);
    expect(mockPreloadOgabasseyPdpProductImage).toHaveBeenCalledWith({
      src: productImage,
    });
    expect(mockOgabasseyPdpProductResourceHints).toHaveBeenCalledWith({
      src: productImage,
    });
  });

  it('preloads the OgaBassey PDP product image before full product details resolve', async () => {
    let resolveProductDetails:
      | ((value: typeof categorizedDetailedProduct) => void)
      | undefined;
    const earlyProductImage =
      'https://cdn.ogabassey.com/core-assets/products/early-lenovo-legion.avif';
    mockGetCachedProductLcpHint.mockResolvedValueOnce(
      toLegacyCachedProduct({
        ...categorizedDetailedProduct,
        images: [earlyProductImage],
      })
    );
    mockGetCachedProductWithDetails.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveProductDetails = resolve;
      })
    );

    const pagePromise = CategoryProductPage({
      params: Promise.resolve({
        slug: 'teststore',
        category: 'laptops',
        productSlug: 'hp-laptop-14-ep0063nia',
      }),
      searchParams: Promise.resolve({}),
    });

    // Run the early lookup by calling resolveRsc on the page promise.
    // This will execute the early lookup component synchronously/asynchronously, while the main content suspends.
    const resolvedPage = await resolveRsc(pagePromise, { skipContent: true });

    expect(mockGetCachedProductLcpHint).toHaveBeenCalledWith(
      baseMerchant.id,
      'hp-laptop-14-ep0063nia'
    );
    expect(mockPreloadOgabasseyPdpProductImage).toHaveBeenCalledWith({
      src: earlyProductImage,
    });
    expect(mockOgabasseyPdpProductResourceHints).toHaveBeenCalledWith({
      src: earlyProductImage,
    });
    expect(mockOgabasseyProductDetailsPage).not.toHaveBeenCalled();

    resolveProductDetails?.(categorizedDetailedProduct);
    render(await resolveRsc(resolvedPage));

    expect(mockPreloadOgabasseyPdpProductImage).toHaveBeenCalledTimes(1);
    expect(mockOgabasseyPdpDeferredDetailIsland).toHaveBeenCalled();
  });

  it('preloads the OgaBassey PDP product image without awaiting tracking-only query routes', async () => {
    let resolveProductDetails:
      | ((value: typeof categorizedDetailedProduct) => void)
      | undefined;
    const earlyProductImage =
      'https://cdn.ogabassey.com/core-assets/products/campaign-laptop.avif';
    mockGetCachedProductLcpHint.mockResolvedValueOnce(
      toLegacyCachedProduct({
        ...categorizedDetailedProduct,
        images: [earlyProductImage],
      })
    );
    mockGetCachedProductWithDetails.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveProductDetails = resolve;
      })
    );

    const resolvedPage = await resolveRsc(
      CategoryProductPage({
        params: Promise.resolve({
          slug: 'teststore',
          category: 'laptops',
          productSlug: 'hp-laptop-14-ep0063nia',
        }),
        searchParams: Promise.resolve({
          utm_source: 'google',
          gclid: 'campaign-click',
        }),
      }),
      { skipContent: true }
    );

    expect(mockPreloadOgabasseyPdpProductImage).toHaveBeenCalledWith({
      src: earlyProductImage,
    });
    expect(mockOgabasseyProductDetailsPage).not.toHaveBeenCalled();

    resolveProductDetails?.(categorizedDetailedProduct);
    render(await resolveRsc(resolvedPage));
  });

  it('redirects invalid variant query routes before streaming early product hints', async () => {
    const productImage =
      'https://cdn.ogabassey.com/core-assets/products/variant-laptop.avif';
    const variants = [
      {
        id: 'variant-used-128',
        attributes: { storage: '128GB' },
        condition: 'used',
        stock_quantity: 3,
      },
    ];
    mockGetCachedProductLcpHint.mockResolvedValueOnce(
      toLegacyCachedProduct({
        ...categorizedDetailedProduct,
        images: [productImage],
      })
    );
    mockGetCachedProductWithDetails.mockResolvedValueOnce({
      ...categorizedDetailedProduct,
      images: [productImage],
      product_variants: variants,
    });
    mockNormalizeStorefrontProductVariants.mockReturnValueOnce(variants);

    await expect(
      CategoryProductPage({
        params: Promise.resolve({
          slug: 'teststore',
          category: 'laptops',
          productSlug: 'hp-laptop-14-ep0063nia',
        }),
        searchParams: Promise.resolve({ storage: '128GB' }),
      })
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(mockPermanentRedirect).toHaveBeenCalledTimes(1);
    expect(mockPreloadOgabasseyPdpProductImage).not.toHaveBeenCalled();
    expect(mockOgabasseyPdpProductResourceHints).not.toHaveBeenCalled();
  });

  it('allows valid variantId query routes to stream product hints without redirecting', async () => {
    const productImage =
      'https://cdn.ogabassey.com/core-assets/products/variant-laptop.avif';
    const variants = [
      {
        id: 'variant-used-128',
        attributes: { storage: '128GB' },
        condition: 'used',
        stock_quantity: 3,
      },
    ];
    mockGetCachedProductLcpHint.mockResolvedValueOnce(
      toLegacyCachedProduct({
        ...categorizedDetailedProduct,
        images: [productImage],
      })
    );
    mockGetCachedProductWithDetails.mockResolvedValueOnce({
      ...categorizedDetailedProduct,
      images: [productImage],
      product_variants: variants,
    });
    mockNormalizeStorefrontProductVariants.mockReturnValueOnce(variants);

    const ui = await resolveRsc(
      await CategoryProductPage({
        params: Promise.resolve({
          slug: 'teststore',
          category: 'laptops',
          productSlug: 'hp-laptop-14-ep0063nia',
        }),
        searchParams: Promise.resolve({ variantId: 'variant-used-128' }),
      })
    );

    render(ui);

    expect(mockPermanentRedirect).not.toHaveBeenCalled();
    expect(mockPreloadOgabasseyPdpProductImage).toHaveBeenCalledWith({
      src: productImage,
    });
    expect(mockOgabasseyPdpProductResourceHints).toHaveBeenCalledWith({
      src: productImage,
    });
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'HP Laptop 14-ep0063nia',
      })
    ).toBeInTheDocument();
  });

  it('skips early product preload when the cached product has no image and still renders details', async () => {
    const fallbackProductImage =
      'https://cdn.ogabassey.com/core-assets/products/fallback-laptop.avif';
    mockGetCachedProductLcpHint.mockResolvedValueOnce(
      toLegacyCachedProduct({
        ...categorizedDetailedProduct,
        images: [],
      })
    );
    mockGetCachedProductWithDetails.mockResolvedValueOnce({
      ...categorizedDetailedProduct,
      images: [fallbackProductImage],
    });

    render(
      await resolveRsc(
        await CategoryProductPage({
          params: Promise.resolve({
            slug: 'teststore',
            category: 'laptops',
            productSlug: 'hp-laptop-14-ep0063nia',
          }),
          searchParams: Promise.resolve({}),
        })
      )
    );

    expect(mockPreloadOgabasseyPdpProductImage).not.toHaveBeenCalled();
    expect(mockOgabasseyPdpProductResourceHints).not.toHaveBeenCalled();
    expect(mockOgabasseyPdpDeferredDetailIsland).toHaveBeenCalled();
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
    const productImage =
      'https://cdn.ogabassey.com/core-assets/products/lenovo-legion.avif';
    mockGetCachedProductLcpHint.mockResolvedValueOnce(
      toLegacyCachedProduct({
        ...categorizedDetailedProduct,
        images: [productImage],
      })
    );
    mockGetCachedProductWithDetails.mockResolvedValueOnce({
      ...categorizedDetailedProduct,
      images: [productImage],
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

    render(await resolveRsc(pageUi));
    expect(mockOgabasseyPdpProductResourceHints).toHaveBeenCalledWith({
      src: productImage,
    });
    expect(mockOgabasseyPdpDeferredDetailIsland).toHaveBeenCalledWith(
      expect.objectContaining({
        product: expect.objectContaining({
          image: productImage,
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
      await resolveRsc(
        await CategoryProductPage({
          params: Promise.resolve({
            slug: 'teststore',
            category: 'laptops',
            productSlug: 'hp-laptop-14-ep0063nia',
          }),
          searchParams: Promise.resolve({}),
        })
      )
    );

    expect(mockOgabasseyPdpStaticResourceHints).not.toHaveBeenCalled();
    expect(mockPreloadOgabasseyPdpProductImage).not.toHaveBeenCalled();
    expect(mockOgabasseyPdpProductResourceHints).not.toHaveBeenCalled();
  });

  it('keeps the generic product client behind the default branch loader', () => {
    const routeSource = readFileSync(
      join(
        process.cwd(),
        'src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/page.tsx'
      ),
      { encoding: 'utf8' }
    );

    expect(routeSource).not.toContain(
      "import ProductDetailClient from '@/app/(storefront)/[slug]/(catalog)/(pdp)/products/[productSlug]/product-detail-client'"
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
      await resolveRsc(
        await CategoryProductPage({
          params: Promise.resolve({
            slug: 'teststore',
            category: 'smartphones',
            productSlug: 'iphone-13',
          }),
          searchParams: Promise.resolve({}),
        })
      )
    );

    const ogabasseyProps = mockOgabasseyPdpDeferredDetailIsland.mock.calls
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
      await resolveRsc(
        await CategoryProductPage({
          params: Promise.resolve({
            slug: 'teststore',
            category: 'smartphones',
            productSlug: 'iphone-15',
          }),
          searchParams: Promise.resolve({}),
        })
      )
    );

    const ogabasseyProps = mockOgabasseyPdpDeferredDetailIsland.mock.calls
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
      await resolveRsc(
        await CategoryProductPage({
          params: Promise.resolve({
            slug: 'teststore',
            category: 'laptops',
            productSlug: 'hp-laptop-14-ep0063nia',
          }),
          searchParams: Promise.resolve({}),
        })
      )
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
          await resolveRsc(
            await CategoryProductPage({
              params: Promise.resolve({
                slug: 'teststore',
                category: 'laptops',
                productSlug: 'hp-laptop-14-ep0063nia',
              }),
              searchParams: Promise.resolve({}),
            }),
            { stripSuspense: true }
          )
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
      await resolveRsc(
        await CategoryProductPage({
          params: Promise.resolve({
            slug: 'teststore',
            category: 'laptops',
            productSlug: 'hp-laptop-14-ep0063nia',
          }),
          searchParams: Promise.resolve({}),
        })
      )
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
      await resolveRsc(
        await CategoryProductPage({
          params: Promise.resolve({
            slug: 'teststore',
            category: 'smartphones',
            productSlug: 'samsung-galaxy-z-trifold',
          }),
          searchParams: Promise.resolve({}),
        })
      )
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
      await resolveRsc(
        await CategoryProductPage({
          params: Promise.resolve({
            slug: 'teststore',
            category: 'smartphones',
            productSlug: 'samsung-galaxy-z-trifold',
          }),
          searchParams: Promise.resolve({}),
        })
      )
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
      await resolveRsc(
        await CategoryProductPage({
          params: Promise.resolve({
            slug: 'teststore',
            category: 'smartphones',
            productSlug: 'samsung-galaxy-z-trifold',
          }),
          searchParams: Promise.resolve({}),
        })
      )
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
