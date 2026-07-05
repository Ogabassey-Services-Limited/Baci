import { render, screen, within } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OGABASSEY_MERCHANT_ID } from '@/config/ogabassey';

const {
  mockGenerateBreadcrumbSchema,
  mockGenerateCollectionPageSchema,
  mockGetCachedCategories,
  mockGetCachedProductCanonicalPaths,
  mockGetCachedProductSemanticInventory,
  mockGetCachedStorefrontProductIndex,
  mockGetRequestScopedMerchant,
  mockHeaders,
} = vi.hoisted(() => ({
  mockGenerateBreadcrumbSchema: vi.fn(() => ({})),
  mockGenerateCollectionPageSchema: vi.fn(() => ({})),
  mockGetCachedCategories: vi.fn(),
  mockGetCachedProductCanonicalPaths: vi.fn(),
  mockGetCachedProductSemanticInventory: vi.fn(),
  mockGetCachedStorefrontProductIndex: vi.fn(),
  mockGetRequestScopedMerchant: vi.fn(),
  mockHeaders: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: () => mockHeaders(),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    prefetch: _prefetch,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    prefetch?: boolean;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

vi.mock(
  '@/components/storefront/ogabassey/components/StorefrontPagination',
  () => ({
    StorefrontPagination: () => null,
  })
);

vi.mock('@/lib/cached-data', () => ({
  getCachedCategories: (...args: unknown[]) => mockGetCachedCategories(...args),
  getRequestScopedMerchant: (...args: unknown[]) =>
    mockGetRequestScopedMerchant(...args),
}));

vi.mock('@/lib/cached-product-canonical-paths', () => ({
  getCachedProductCanonicalPaths: (...args: unknown[]) =>
    mockGetCachedProductCanonicalPaths(...args),
}));

vi.mock('@/lib/cached-storefront-product-index', () => ({
  getCachedStorefrontProductIndex: (...args: unknown[]) =>
    mockGetCachedStorefrontProductIndex(...args),
}));

vi.mock(
  '@/lib/storefront-product/get-cached-product-semantic-inventory',
  () => ({
    getCachedProductSemanticInventory: (...args: unknown[]) =>
      mockGetCachedProductSemanticInventory(...args),
  })
);

vi.mock('@/lib/routes', () => ({
  asRoute: (path: string) => path,
}));

vi.mock('@/components/seo/json-ld', () => ({
  JsonLd: () => null,
}));

vi.mock('@/lib/seo-utils', () => ({
  generateSlug: (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, ''),
  generateBreadcrumbSchema: mockGenerateBreadcrumbSchema,
  generateCollectionPageSchema: mockGenerateCollectionPageSchema,
}));

vi.mock('@/lib/store-url', () => ({
  buildStoreUrl: () => 'https://ogabassey.com',
}));

vi.mock('@/lib/validation', () => ({
  isValidMerchantIdentifier: () => true,
}));

vi.mock('./product-index-card', () => ({
  ProductIndexCard: () => null,
}));

const { ProductsPageContent } = await import('./products-page-content');

const OGABASSEY_TEST_MERCHANT = {
  id: OGABASSEY_MERCHANT_ID,
  business_name: 'Ogabassey',
  custom_domain: 'ogabassey.com',
  slug: 'ogabassey',
  country: 'NG',
  payout_currency: 'NGN',
  site_description: 'Browse products',
};

describe('ProductsPageContent internal link equity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHeaders.mockResolvedValue(new Headers());
    mockGetCachedCategories.mockResolvedValue([
      {
        id: 'cat-1',
        name: 'Smartphones',
        slug: 'smartphones',
        is_active: true,
        product_count: 120,
      },
      {
        id: 'cat-2',
        name: 'Laptops',
        slug: 'laptops',
        is_active: true,
        product_count: 40,
      },
    ]);
    mockGetCachedProductCanonicalPaths.mockResolvedValue({});
    mockGetCachedProductSemanticInventory.mockImplementation(
      (_merchantId: string, categorySlug: string) =>
        categorySlug === 'smartphones'
          ? Promise.resolve([
              {
                slug: 'xiaomi-13t',
                name: 'Xiaomi 13T',
                brand: 'Xiaomi',
                price: 450_000,
                category_slug: 'smartphones',
                product_key_specs: {
                  chipset: 'Dimensity 8200 Ultra',
                  ram_gb: 8,
                  storage_gb: 256,
                },
              },
              {
                slug: 'google-pixel-8',
                name: 'Google Pixel 8',
                brand: 'Google',
                price: 620_000,
                category_slug: 'smartphones',
                product_key_specs: {
                  chipset: 'Tensor G3',
                  ram_gb: 12,
                  storage_gb: 128,
                },
              },
            ])
          : Promise.resolve([])
    );
    mockGetCachedStorefrontProductIndex.mockResolvedValue({
      hasError: false,
      products: [],
      totalCount: 0,
      totalPages: 6,
    });
  });

  it('renders Ogabassey-only maintained modules on custom-domain product pages', async () => {
    mockHeaders.mockResolvedValue(
      new Headers([['x-custom-domain', 'ogabassey.com']])
    );
    mockGetRequestScopedMerchant.mockResolvedValue(OGABASSEY_TEST_MERCHANT);

    const result = await ProductsPageContent({
      params: Promise.resolve({ slug: 'ogabassey' }),
      searchParams: Promise.resolve({ page: '1' }),
    });

    render(result as React.ReactElement);

    expect(
      screen.getByRole('heading', { name: 'Explore Ogabassey buying paths' })
    ).toBeInTheDocument();
    const shortcutSection = screen.getByRole('region', {
      name: 'Explore Ogabassey buying paths',
    });
    expect(
      within(shortcutSection).getByRole('link', { name: 'Smartphones' })
    ).toHaveAttribute('href', '/smartphones');
    expect(
      within(shortcutSection).getByRole('link', { name: 'Laptops' })
    ).toHaveAttribute('href', '/laptops');
    expect(
      within(shortcutSection).getByRole('link', { name: 'Products page 6' })
    ).toHaveAttribute('href', '/products?page=6');
    expect(
      within(shortcutSection).getByRole('link', {
        name: 'Compare Xiaomi 13T with Google Pixel 8',
      })
    ).toHaveAttribute(
      'href',
      '/smartphones/compare/google-pixel-8-vs-xiaomi-13t'
    );
    expect(
      screen.queryByRole('link', { name: 'iPhone 16 Pro 512GB open box' })
    ).not.toBeInTheDocument();
    expect(mockGetCachedProductCanonicalPaths).not.toHaveBeenCalled();

    const shortcutHrefs = within(shortcutSection)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));

    expect(new Set(shortcutHrefs).size).toBe(shortcutHrefs.length);
    expect(shortcutHrefs.every((href) => href?.startsWith('/'))).toBe(true);
    expect(shortcutHrefs.some((href) => href?.startsWith('http'))).toBe(false);
    expect(shortcutHrefs).toEqual(
      expect.arrayContaining(['/laptops', '/products?page=6', '/smartphones'])
    );
  });

  it('does not render manual product shortcut labels', async () => {
    mockHeaders.mockResolvedValue(
      new Headers([['x-custom-domain', 'ogabassey.com']])
    );
    mockGetRequestScopedMerchant.mockResolvedValue(OGABASSEY_TEST_MERCHANT);

    const result = await ProductsPageContent({
      params: Promise.resolve({ slug: 'ogabassey' }),
      searchParams: Promise.resolve({ page: '1' }),
    });

    render(result as React.ReactElement);

    expect(
      screen.queryByRole('link', { name: 'iPhone Air' })
    ).not.toBeInTheDocument();
    expect(mockGetCachedProductCanonicalPaths).not.toHaveBeenCalled();
  });

  it('does not render the shortcuts for other merchants', async () => {
    mockGetRequestScopedMerchant.mockResolvedValue({
      id: 'merchant-1',
      business_name: 'Demo Store',
      slug: 'demo-store',
      country: 'NG',
      payout_currency: 'NGN',
      site_description: 'Browse products',
    });

    const result = await ProductsPageContent({
      params: Promise.resolve({ slug: 'demo-store' }),
      searchParams: Promise.resolve({ page: '1' }),
    });

    render(result as React.ReactElement);

    expect(
      screen.queryByRole('heading', { name: 'Explore Ogabassey buying paths' })
    ).not.toBeInTheDocument();
    expect(mockGetCachedProductCanonicalPaths).not.toHaveBeenCalled();
  });
});
