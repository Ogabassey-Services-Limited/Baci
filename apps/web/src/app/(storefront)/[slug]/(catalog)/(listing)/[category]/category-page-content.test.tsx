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
  safeJsonLdStringify: (value: unknown) => JSON.stringify(value),
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

vi.mock('@/lib/validation', () => ({
  isDomainIdentifier: (value: string) => value.includes('.'),
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

  it('renders collection, breadcrumb, and FAQ JSON-LD through the shared JsonLd component', async () => {
    mockGetMerchantByIdentifier.mockResolvedValue({
      id: 'merchant-1',
      business_name: 'Demo Store',
      slug: 'demo-store',
      country: 'NG',
      payout_currency: 'NGN',
    });
    mockBuildCategoryPageHubModel.mockReturnValueOnce({
      intro: { heading: 'Phones', description: 'Phone collection' },
      trustFeatures: [],
      faqItems: [
        {
          question: 'Do these phones have warranty?',
          answer: 'Yes, eligible phones include warranty coverage.',
        },
      ],
    });
    mockGenerateCollectionPageSchema.mockReturnValueOnce({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Phones collection',
    });
    mockGenerateBreadcrumbSchema.mockReturnValueOnce({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
    });
    mockGenerateFAQSchema.mockReturnValueOnce({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
    });

    const ui = await CategoryPageContent({
      params: Promise.resolve({ slug: 'demo-store', category: 'phones' }),
      searchParams: Promise.resolve({ page: '1' }),
    });

    const { container } = render(ui);
    const schemaScripts = container.querySelectorAll(
      'script[type="application/ld+json"]'
    );

    expect(schemaScripts).toHaveLength(3);
    expect(schemaScripts[0]?.textContent).toContain('"@type":"CollectionPage"');
    expect(schemaScripts[1]?.textContent).toContain('"@type":"BreadcrumbList"');
    expect(schemaScripts[2]?.textContent).toContain('"@type":"FAQPage"');
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

  it('keeps missing merchants hard-404 even when the requested page parameter is invalid', async () => {
    mockGetMerchantByIdentifier.mockResolvedValue(null);

    await expect(
      CategoryPageContent({
        params: Promise.resolve({
          slug: 'unknown-merchant',
          category: 'phones',
        }),
        searchParams: Promise.resolve({ page: 'invalid' }),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(mockGetCachedCategoryPageData).not.toHaveBeenCalled();
  });

  it('renders stable noindex soft-not-found content for an unknown category slug with no products', async () => {
    // Unknown/typo slug: merchant resolves, but the category data has no
    // collection, no category row, and no fuzzy-matched products. Metadata stays
    // noindex; content must not throw inside the streamed route boundary.
    mockGetMerchantByIdentifier.mockResolvedValue({
      id: 'merchant-1',
      business_name: 'Demo Store',
      slug: 'demo-store',
      country: 'NG',
      payout_currency: 'NGN',
    });
    mockGetCachedCategoryPageData.mockResolvedValue({
      isCollection: false,
      category: null,
      products: [],
      isInactiveCategory: false,
    });

    render(
      await CategoryPageContent({
        params: Promise.resolve({
          slug: 'demo-store',
          category: 'totally-made-up-slug',
        }),
        searchParams: Promise.resolve({ page: '1' }),
      })
    );

    expect(
      screen.getByRole('heading', { name: 'Category not found' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Continue shopping' })
    ).toHaveAttribute('href', '/demo-store');
    expect(mockGenerateCollectionPageSchema).not.toHaveBeenCalled();
  });

  it('fails open for out-of-range content pages when product pagination data is partial', async () => {
    mockGetMerchantByIdentifier.mockResolvedValue({
      id: 'merchant-1',
      business_name: 'Demo Store',
      slug: 'demo-store',
      country: 'NG',
      payout_currency: 'NGN',
    });
    mockGetCachedCategoryPageData.mockResolvedValue({
      isCollection: false,
      category: { id: 'cat-1', name: 'Phones', slug: 'phones' },
      products: [],
      fallbackName: 'Phones',
      fallbackDescription: 'Phones',
      isInactiveCategory: false,
      productsQueryFailed: true,
    });
    mockNormalizeCategoryPageProducts.mockReturnValue([]);

    const ui = await CategoryPageContent({
      params: Promise.resolve({ slug: 'demo-store', category: 'phones' }),
      searchParams: Promise.resolve({ page: '3' }),
    });

    render(ui);

    expect(screen.getByTestId('category-page')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Category page not found' })
    ).not.toBeInTheDocument();
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
