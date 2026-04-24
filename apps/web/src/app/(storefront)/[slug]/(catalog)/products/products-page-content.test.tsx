import { render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('@/lib/sanitize-json-ld', () => ({
  safeJsonLdStringify: () => '{}',
}));

vi.mock('@/lib/seo-utils', () => ({
  generateBreadcrumbSchema: mockGenerateBreadcrumbSchema,
  generateCollectionPageSchema: mockGenerateCollectionPageSchema,
}));

vi.mock('@/lib/store-url', () => ({
  buildStoreUrl: () => 'https://store.example.com',
}));

vi.mock('@/lib/validation', () => ({
  isValidMerchantIdentifier: () => true,
}));

vi.mock('./product-index-card', () => ({
  ProductIndexCard: () => null,
}));

const { ProductsPageContent } = await import('./products-page-content');

describe('ProductsPageContent', () => {
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

  it('passes the merchant payout currency into collection schema generation', async () => {
    mockGetRequestScopedMerchant.mockResolvedValue({
      id: 'merchant-1',
      business_name: 'Demo Store',
      slug: 'demo-store',
      country: 'GH',
      payout_currency: 'GHS',
      site_description: 'Browse products',
    });

    await ProductsPageContent({
      params: Promise.resolve({ slug: 'demo-store' }),
      searchParams: Promise.resolve({ page: '1' }),
    });

    expect(mockGenerateCollectionPageSchema).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'GHS' })
    );
  });

  it('preserves distinct merchant-defined category slugs without alias remapping', async () => {
    mockGetRequestScopedMerchant.mockResolvedValue({
      id: 'merchant-1',
      business_name: 'Demo Store',
      slug: 'demo-store',
      country: 'NG',
      payout_currency: 'NGN',
      site_description: 'Browse products',
    });
    mockGetCachedCategories.mockResolvedValue([
      // Prior to the fix, both `samsung` and `phones` were remapped to
      // `smartphones` and deduped into a single entry, hiding the Samsung
      // category link. After the fix, each stored slug should stand on its
      // own.
      { id: 'cat-samsung', name: 'Samsung', slug: 'samsung' },
      { id: 'cat-phones', name: 'Phones', slug: 'phones' },
      { id: 'cat-smartphones', name: 'Smartphones', slug: 'smartphones' },
      { id: 'cat-macbook', name: 'Macbook', slug: 'macbook' },
      { id: 'cat-laptops', name: 'Laptops', slug: 'laptops' },
      // Pure case/whitespace duplicate — should still collapse.
      { id: 'cat-laptops-dup', name: 'Laptops (dup)', slug: ' Laptops ' },
    ]);

    const result = await ProductsPageContent({
      params: Promise.resolve({ slug: 'demo-store' }),
      searchParams: Promise.resolve({ page: '1' }),
    });

    render(result as React.ReactElement);

    // Each merchant-defined distinct slug should render its own link. Assert
    // against the actual rendered anchors so we don't couple to React element
    // internals or `JSON.stringify` shape.
    expect(screen.getByRole('link', { name: 'Samsung' })).toHaveAttribute(
      'href',
      '/demo-store/samsung'
    );
    expect(screen.getByRole('link', { name: 'Phones' })).toHaveAttribute(
      'href',
      '/demo-store/phones'
    );
    expect(screen.getByRole('link', { name: 'Smartphones' })).toHaveAttribute(
      'href',
      '/demo-store/smartphones'
    );
    expect(screen.getByRole('link', { name: 'Macbook' })).toHaveAttribute(
      'href',
      '/demo-store/macbook'
    );

    // Pure case/whitespace duplicates should still collapse — exactly one
    // "Laptops*" link should render, pointing at the canonical lowercased
    // slug and never the raw ` Laptops ` variant.
    const laptopLinks = screen.getAllByRole('link', {
      name: /^Laptops/,
    });
    expect(laptopLinks).toHaveLength(1);
    expect(laptopLinks[0]).toHaveAttribute('href', '/demo-store/laptops');
  });

  it("falls back to 'NGN' when merchant payout currency is missing", async () => {
    mockGetRequestScopedMerchant.mockResolvedValue({
      id: 'merchant-1',
      business_name: 'Demo Store',
      slug: 'demo-store',
      country: null,
      payout_currency: null,
      site_description: 'Browse products',
    });

    await ProductsPageContent({
      params: Promise.resolve({ slug: 'demo-store' }),
      searchParams: Promise.resolve({ page: '1' }),
    });

    expect(mockGenerateCollectionPageSchema).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'NGN' })
    );
  });
});
