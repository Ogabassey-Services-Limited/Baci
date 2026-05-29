import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockBuildCategoryPageHubModel,
  mockBuildRequestScopedStoreUrl,
  mockBuildStoreUrl,
  mockGenerateBreadcrumbSchema,
  mockGenerateCollectionPageSchema,
  mockGenerateFAQSchema,
  mockGetCachedCategoryPageData,
  mockGetMerchantByIdentifier,
  mockGetPublishedClusterPosts,
  mockHeaders,
  mockNormalizeCategoryPageProducts,
  mockResolveCategoryPageName,
} = vi.hoisted(() => ({
  mockBuildCategoryPageHubModel: vi.fn(),
  mockBuildRequestScopedStoreUrl: vi.fn(),
  mockBuildStoreUrl: vi.fn(),
  mockGenerateBreadcrumbSchema: vi.fn(() => ({})),
  mockGenerateCollectionPageSchema: vi.fn(() => ({})),
  mockGenerateFAQSchema: vi.fn(() => ({})),
  mockGetCachedCategoryPageData: vi.fn(),
  mockGetMerchantByIdentifier: vi.fn(),
  mockGetPublishedClusterPosts: vi.fn(),
  mockHeaders: vi.fn(),
  mockNormalizeCategoryPageProducts: vi.fn(),
  mockResolveCategoryPageName: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: () => mockHeaders(),
}));

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

vi.mock('@/components/storefront/ogabassey/pages/category-page', () => ({
  CategoryPage: ({
    products,
  }: {
    products?: Array<{ id: string; name: string; price: string }>;
  }) => (
    <div data-testid="category-page">
      Category page
      {products?.map((product) => (
        <div key={product.id}>
          {product.name}: {product.price}
        </div>
      ))}
    </div>
  ),
}));

vi.mock('@/components/ui/skeletons', () => ({
  ProductGridSkeleton: () => null,
}));

vi.mock(
  '@/components/storefront/ogabassey/providers/v2-comparison-scope',
  () => ({
    V2ComparisonScope: ({
      children,
      storageNamespace,
    }: {
      children: ReactNode;
      storageNamespace?: string | null;
    }) => (
      <div
        data-storage-namespace={storageNamespace ?? ''}
        data-testid="comparison-scope"
      >
        {children}
      </div>
    ),
  })
);

vi.mock('@/lib/cached-data', () => ({
  getCachedCategoryPageData: (...args: unknown[]) =>
    mockGetCachedCategoryPageData(...args),
  getMerchantByIdentifier: (...args: unknown[]) =>
    mockGetMerchantByIdentifier(...args),
}));

vi.mock('@/lib/sanitize-json-ld', () => ({
  safeJsonLdStringify: () => '{}',
}));

vi.mock('@/lib/seo-utils', () => ({
  generateBreadcrumbSchema: mockGenerateBreadcrumbSchema,
  generateCollectionPageSchema: mockGenerateCollectionPageSchema,
  generateFAQSchema: mockGenerateFAQSchema,
}));

vi.mock('@/lib/store-url', () => ({
  buildRequestScopedStoreUrl: (...args: unknown[]) =>
    mockBuildRequestScopedStoreUrl(...args),
  buildStoreUrl: (...args: unknown[]) => mockBuildStoreUrl(...args),
}));

vi.mock('@/lib/storefront-content/get-published-cluster-posts', () => ({
  getPublishedClusterPosts: (...args: unknown[]) =>
    mockGetPublishedClusterPosts(...args),
}));

vi.mock('./category-page-content-helpers', () => ({
  STOREFRONT_PRODUCTS_PER_PAGE: 24,
  buildCategoryPageHubModel: (...args: unknown[]) =>
    mockBuildCategoryPageHubModel(...args),
  normalizeCategoryPageProducts: (...args: unknown[]) =>
    mockNormalizeCategoryPageProducts(...args),
  resolveCategoryPageName: (...args: unknown[]) =>
    mockResolveCategoryPageName(...args),
}));

const { CategoryPageContent } = await import('./category-page-content');

describe('CategoryPageContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHeaders.mockResolvedValue(new Headers());
    mockBuildStoreUrl.mockReturnValue('https://store.example.com');
    mockBuildRequestScopedStoreUrl.mockReturnValue('https://store.example.com');
    mockGetPublishedClusterPosts.mockResolvedValue([]);
    mockGetCachedCategoryPageData.mockResolvedValue({
      isCollection: true,
      category: null,
      products: [{ id: 'product-1' }],
    });
    mockResolveCategoryPageName.mockReturnValue('Phones');
    mockNormalizeCategoryPageProducts.mockReturnValue([
      {
        id: 'product-1',
        name: 'Phone',
        description: 'Phone description',
        rawPrice: 250000,
        stock: 5,
        image: 'https://cdn.example.com/phone.png',
        brand: 'Brand',
        category: 'Phones',
        category_slug: 'phones',
        slug: 'phone',
        condition: 'new',
      },
    ]);
    mockBuildCategoryPageHubModel.mockReturnValue({
      intro: { heading: 'Phones', description: 'Phone collection' },
      trustFeatures: [],
      faqItems: [],
    });
  });

  it('passes the merchant payout currency into collection schema generation', async () => {
    mockGetMerchantByIdentifier.mockResolvedValue({
      id: 'merchant-1',
      business_name: 'Demo Store',
      slug: 'demo-store',
      country: 'KE',
      payout_currency: 'KES',
    });

    await CategoryPageContent({
      params: Promise.resolve({ slug: 'demo-store', category: 'phones' }),
      searchParams: Promise.resolve({ page: '1' }),
    });

    expect(mockGenerateCollectionPageSchema).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'KES' })
    );
  });

  it('renders category product prices with the merchant country currency', async () => {
    mockGetMerchantByIdentifier.mockResolvedValue({
      id: 'merchant-1',
      business_name: 'Demo Store',
      slug: 'demo-store',
      country: 'IN',
      payout_currency: 'INR',
    });
    mockNormalizeCategoryPageProducts.mockImplementation(
      (_products, _category, country) => [
        {
          id: 'product-1',
          name: 'Phone',
          description: 'Phone description',
          price: country === 'IN' ? '₹2,500' : '₦2,500',
          rawPrice: 2500,
          stock: 5,
          image: 'https://cdn.example.com/phone.png',
          brand: 'Brand',
          category: 'Phones',
          category_slug: 'phones',
          slug: 'phone',
          condition: 'new',
        },
      ]
    );

    const ui = await CategoryPageContent({
      params: Promise.resolve({ slug: 'demo-store', category: 'phones' }),
      searchParams: Promise.resolve({ page: '1' }),
    });
    render(ui);

    expect(mockNormalizeCategoryPageProducts).toHaveBeenCalledWith(
      [{ id: 'product-1' }],
      'phones',
      'IN'
    );
    expect(screen.getByText('Phone: ₹2,500')).toBeInTheDocument();
    expect(screen.queryByText(/₦/)).not.toBeInTheDocument();
  });

  it("falls back to 'NGN' when merchant payout currency is missing", async () => {
    mockGetMerchantByIdentifier.mockResolvedValue({
      id: 'merchant-1',
      business_name: 'Demo Store',
      slug: 'demo-store',
      country: null,
      payout_currency: null,
    });

    await CategoryPageContent({
      params: Promise.resolve({ slug: 'demo-store', category: 'phones' }),
      searchParams: Promise.resolve({ page: '1' }),
    });

    expect(mockGenerateCollectionPageSchema).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'NGN' })
    );
  });

  it('calls notFound() when the merchant lookup returns null', async () => {
    // The merchant slug does not resolve — page should 404, not render.
    mockGetMerchantByIdentifier.mockResolvedValue(null);

    await expect(
      CategoryPageContent({
        params: Promise.resolve({
          slug: 'unknown-merchant',
          category: 'phones',
        }),
        searchParams: Promise.resolve({ page: '1' }),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');

    // Downstream schema generation should never run for a 404 response.
    expect(mockGenerateCollectionPageSchema).not.toHaveBeenCalled();
    expect(mockGetCachedCategoryPageData).not.toHaveBeenCalled();
  });

  it('wraps category products in the comparison scope required by product cards', async () => {
    mockGetMerchantByIdentifier.mockResolvedValue({
      id: 'merchant-1',
      business_name: 'Demo Store',
      slug: 'demo-store',
      country: null,
      payout_currency: null,
    });

    const ui = await CategoryPageContent({
      params: Promise.resolve({ slug: 'demo-store', category: 'phones' }),
      searchParams: Promise.resolve({ page: '1' }),
    });

    render(ui);

    expect(screen.getByTestId('comparison-scope')).toContainElement(
      screen.getByTestId('category-page')
    );
    expect(screen.getByTestId('comparison-scope')).toHaveAttribute(
      'data-storage-namespace',
      'merchant-1'
    );
  });
});
