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
  CategoryPage: () => null,
}));

vi.mock('@/components/ui/skeletons', () => ({
  ProductGridSkeleton: () => null,
}));

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
});
