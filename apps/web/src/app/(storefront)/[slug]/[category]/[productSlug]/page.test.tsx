import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPermanentRedirect = vi.fn((_url: string) => {
  throw new Error('NEXT_REDIRECT');
});
const mockNotFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
const mockGetCachedMerchant = vi.fn();
const mockGetCachedMerchantByDomain = vi.fn();
const mockGetCachedLegacyProductRedirectTarget = vi.fn();
const mockGetCachedProductWithDetails = vi.fn();

vi.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
  permanentRedirect: (url: string) => mockPermanentRedirect(url),
}));

vi.mock('@/components/storefront/ogabassey/pages/product-details-page', () => ({
  ProductDetailsPage: ({ product }: { product: { name: string } }) => (
    <h1>{product.name}</h1>
  ),
}));

vi.mock('@/components/ui/skeletons', () => ({
  ProductDetailSkeleton: () => null,
}));

vi.mock('@/lib/cached-data', () => ({
  getCachedMerchant: (...args: unknown[]) => mockGetCachedMerchant(...args),
  getCachedMerchantByDomain: (...args: unknown[]) =>
    mockGetCachedMerchantByDomain(...args),
  getCachedLegacyProductRedirectTarget: (...args: unknown[]) =>
    mockGetCachedLegacyProductRedirectTarget(...args),
  getCachedProductWithDetails: (...args: unknown[]) =>
    mockGetCachedProductWithDetails(...args),
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
  generateProductSchema: () => ({}),
  generateSlug: (name: string) => name.toLowerCase().replace(/\s+/g, '-'),
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
}));

vi.mock('@/lib/storefront-product-variants', () => ({
  normalizeStorefrontProductVariants: () => [],
}));

vi.mock('@/lib/validation', () => ({
  isDomainIdentifier: (value: string) => value.includes('.'),
  isValidMerchantIdentifier: (value: string) =>
    value.includes('.') ||
    /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(value),
}));

vi.mock(
  '@/app/(storefront)/[slug]/products/[productSlug]/product-detail-client',
  () => ({
    default: () => null,
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
    mockGetCachedMerchant.mockResolvedValue(baseMerchant);
    mockGetCachedProductWithDetails.mockResolvedValue(null);
    mockGetCachedLegacyProductRedirectTarget.mockResolvedValue(null);
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
});

describe('[category]/[productSlug] page render', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCachedMerchant.mockResolvedValue({
      ...baseMerchant,
      template_id: 'ogabassey',
    });
    mockGetCachedProductWithDetails.mockResolvedValue(
      categorizedDetailedProduct
    );
    mockGetCachedLegacyProductRedirectTarget.mockResolvedValue(null);
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
});
