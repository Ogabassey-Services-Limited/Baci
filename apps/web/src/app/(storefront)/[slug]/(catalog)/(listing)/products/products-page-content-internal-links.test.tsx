import { render, screen, within } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OGABASSEY_MERCHANT_ID } from '@/config/ogabassey';
import { OGABASSEY_INTERNAL_LINK_EQUITY_GROUPS } from '@/config/ogabassey-internal-link-equity';

const {
  mockGenerateBreadcrumbSchema,
  mockGenerateCollectionPageSchema,
  mockGetCachedCategories,
  mockGetCachedStorefrontProductIndex,
  mockGetRequestScopedMerchant,
  mockHeaders,
} = vi.hoisted(() => ({
  mockGenerateBreadcrumbSchema: vi.fn(() => ({})),
  mockGenerateCollectionPageSchema: vi.fn(() => ({})),
  mockGetCachedCategories: vi.fn(),
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

vi.mock('@/lib/cached-storefront-product-index', () => ({
  getCachedStorefrontProductIndex: (...args: unknown[]) =>
    mockGetCachedStorefrontProductIndex(...args),
}));

vi.mock('@/lib/routes', () => ({
  asRoute: (path: string) => path,
}));

vi.mock('@/components/seo/json-ld', () => ({
  JsonLd: () => null,
}));

vi.mock('@/lib/seo-utils', () => ({
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

describe('ProductsPageContent internal link equity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHeaders.mockResolvedValue(new Headers());
    mockGetCachedCategories.mockResolvedValue([]);
    mockGetCachedStorefrontProductIndex.mockResolvedValue({
      hasError: false,
      products: [],
      totalCount: 0,
      totalPages: 1,
    });
  });

  it('renders Ogabassey-only shortcuts on custom-domain product pages', async () => {
    mockHeaders.mockResolvedValue(new Headers([['x-custom-domain', '1']]));
    mockGetRequestScopedMerchant.mockResolvedValue({
      id: OGABASSEY_MERCHANT_ID,
      business_name: 'Ogabassey',
      slug: 'ogabassey',
      country: 'NG',
      payout_currency: 'NGN',
      site_description: 'Browse products',
    });

    const result = await ProductsPageContent({
      params: Promise.resolve({ slug: 'ogabassey' }),
      searchParams: Promise.resolve({ page: '1' }),
    });

    render(result as React.ReactElement);

    expect(
      screen.getByRole('heading', { name: 'Explore more buying paths' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'iPhone XR 128GB' })
    ).toHaveAttribute('href', '/smartphones/iphone-xr-3gb-128gb');
    expect(
      screen.getByRole('link', { name: 'Compare products' })
    ).toHaveAttribute('href', '/compare');
    expect(screen.getByRole('link', { name: 'Laptops' })).toHaveAttribute(
      'href',
      '/laptops'
    );

    const shortcutSection = screen.getByRole('region', {
      name: 'Explore more buying paths',
    });
    const shortcutHrefs = within(shortcutSection)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));
    const expectedShortcutCount = OGABASSEY_INTERNAL_LINK_EQUITY_GROUPS.reduce(
      (total, group) => total + group.links.length,
      0
    );

    expect(shortcutHrefs).toHaveLength(expectedShortcutCount);
    expect(new Set(shortcutHrefs).size).toBe(shortcutHrefs.length);
    expect(shortcutHrefs.every((href) => href?.startsWith('/'))).toBe(true);
    expect(shortcutHrefs.some((href) => href?.startsWith('http'))).toBe(false);
    expect(shortcutHrefs).toEqual(
      expect.arrayContaining([
        '/compare',
        '/accessories',
        '/audio',
        '/earbuds',
        '/laptops',
        '/lg-tvs',
        '/portable-gaming',
        '/repair',
        '/repairs',
        '/samsung-tvs',
        '/smartphones',
      ])
    );
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
      screen.queryByRole('heading', { name: 'Explore more buying paths' })
    ).not.toBeInTheDocument();
  });
});
