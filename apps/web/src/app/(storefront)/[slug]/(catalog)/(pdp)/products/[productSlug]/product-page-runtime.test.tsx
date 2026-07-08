import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Focused integration test for the PdpRepairDeviceLink wiring added to
// ProductPageRuntime. The link component itself has full unit coverage in
// components/storefront/repairs/PdpRepairDeviceLink.test.tsx — here we only
// prove the runtime awaits it, passes the right props, and that the real
// feature gate + data-layer lookup decide whether the link is rendered.
//
// Everything ProductPageRuntime touches except PdpRepairDeviceLink (and its
// pure helpers: repairs-feature, routes) is stubbed to keep this light.

const mockMaybeSingle = vi.fn();
const mockFrom = vi.fn();

vi.mock('next/headers', () => ({
  headers: () => Promise.resolve({ get: () => null, has: () => false }),
}));

vi.mock('next/link', () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock('@/components/seo/json-ld', () => ({
  JsonLd: () => null,
}));

vi.mock(
  '@/components/storefront/ogabassey/seo/product-semantic-sections',
  () => ({
    ProductSemanticSections: () => null,
  })
);

vi.mock('./product-detail-client', () => ({
  default: () => <div>product detail client</div>,
}));

vi.mock('@/lib/cached-data', () => ({
  getCachedProductRatingStats: vi.fn(() => Promise.resolve(null)),
  getCachedProductReviews: vi.fn(() => Promise.resolve([])),
  getCachedCategoryPageData: vi.fn(() => Promise.resolve(null)),
  getPublicSupabaseClient: () => ({ from: mockFrom }),
}));

vi.mock('@/lib/korapay', () => ({ isKorapayConfigured: () => true }));
vi.mock('@/lib/paystack', () => ({ isPaystackConfigured: () => true }));

vi.mock('@/lib/seo-utils', () => ({
  buildStorefrontAcceptedPaymentMethods: () => ['Bank transfer'],
  generateAggregateRating: () => null,
  generateBreadcrumbSchema: () => ({}),
  generateFAQSchema: () => ({}),
  generateProductSchema: () => ({ offers: {} }),
  generateSlug: (name: string) => name.toLowerCase().replace(/\s+/g, '-'),
  getValidatedProductUrl: (
    _product: unknown,
    baseUrl: string,
    _slug?: string | null
  ) => `${baseUrl}/products/iphone-13-pro-max`,
}));

vi.mock('@/lib/store-url', () => ({
  buildRequestScopedStoreUrl: () => 'https://teststore.usebaci.com',
}));

vi.mock('@/lib/storefront-content/get-published-cluster-posts', () => ({
  getPublishedClusterPosts: () => Promise.resolve([]),
}));

vi.mock('@/lib/storefront-product/build-product-context-paragraphs', () => ({
  buildProductContextParagraphs: () => [],
}));

vi.mock('@/lib/storefront-product/build-product-semantic-model', () => ({
  buildProductSemanticModel: () => ({
    supportLinks: [],
    guideLinks: [],
    alternatives: null,
    sameBrand: null,
    samePrice: null,
  }),
}));

vi.mock('@/lib/storefront-product-price-seo', () => ({
  buildProductPriceSeoCopy: () => ({
    priceText: '₦495,000',
    title: '',
    description: '',
  }),
}));

vi.mock('@/lib/storefront-trust/build-merchant-trust-profile', () => ({
  buildMerchantTrustProfile: () => ({}),
}));

vi.mock('@/lib/storefront-path-prefix', () => ({
  getStorefrontPathPrefix: () => '/teststore',
}));

const { ProductPageRuntime } = await import('./product-page-runtime');

function buildRepairDeviceQuery(result: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: () => mockMaybeSingle(result),
  };
  return chain;
}

const product = {
  id: 'product-1',
  name: 'iPhone 13 Pro Max',
  slug: 'iphone-13-pro-max',
  brand: 'Apple',
  condition: 'new',
  price: 495000,
  stock: 3,
  category: 'Phones',
  category_slug: 'phones',
  categories: { name: 'Phones', slug: 'phones' },
  product_key_specs: null,
  faqs: undefined,
} as never;

const enabledMerchant = {
  id: 'merchant-1',
  business_name: 'TestStore',
  slug: 'teststore',
  business_type: 'electronics',
  feature_settings: { repairs_catalog_enabled: true },
  payout_currency: 'NGN',
  country: 'NG',
  logo_url: null,
};

describe('ProductPageRuntime — repair device link integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMaybeSingle.mockImplementation((result) => Promise.resolve(result));
  });

  it('renders the "Repair this device" link when a linked device exists and the feature is on', async () => {
    mockFrom.mockReturnValue(
      buildRepairDeviceQuery({
        data: { slug: 'apple-iphone-13-pro-max' },
        error: null,
      })
    );

    render(
      await ProductPageRuntime({
        merchant: enabledMerchant as never,
        product,
        slug: 'teststore',
      })
    );

    expect(
      screen.getByRole('link', { name: /repair this device/i })
    ).toHaveAttribute('href', '/teststore/repairs/apple-iphone-13-pro-max');
  });

  it('does not render the link when no device links to this product', async () => {
    mockFrom.mockReturnValue(
      buildRepairDeviceQuery({ data: null, error: null })
    );

    render(
      await ProductPageRuntime({
        merchant: enabledMerchant as never,
        product,
        slug: 'teststore',
      })
    );

    expect(
      screen.queryByRole('link', { name: /repair this device/i })
    ).not.toBeInTheDocument();
  });

  it('does not query the catalogue or render the link when the repairs feature is off', async () => {
    render(
      await ProductPageRuntime({
        merchant: {
          ...enabledMerchant,
          feature_settings: { repairs_catalog_enabled: false },
        } as never,
        product,
        slug: 'teststore',
      })
    );

    expect(mockFrom).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('link', { name: /repair this device/i })
    ).not.toBeInTheDocument();
  });
});
