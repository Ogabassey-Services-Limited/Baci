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
  default: () => null,
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

    // Render the tree to a plain string so we can assert which category ids
    // appear in the "Browse Categories" links without pulling in a DOM.
    const serialized = JSON.stringify(result);

    // All merchant-defined distinct slugs should remain, not collapsed by an
    // alias remap.
    expect(serialized).toContain('"key":"cat-samsung"');
    expect(serialized).toContain('"key":"cat-phones"');
    expect(serialized).toContain('"key":"cat-smartphones"');
    expect(serialized).toContain('"key":"cat-macbook"');

    // Pure case/whitespace duplicates should still collapse — only one of the
    // two `Laptops` rows should render.
    const laptopMatches =
      serialized.match(/"key":"cat-laptops(?:-dup)?"/g) ?? [];
    expect(laptopMatches).toHaveLength(1);

    // Whichever row wins the dedupe, the rendered category link must use the
    // canonical (trimmed + lowercased) slug — never the raw ` Laptops `
    // variant that would produce a broken URL.
    expect(serialized).toContain('"href":"/demo-store/laptops"');
    expect(serialized).not.toContain('/demo-store/%20Laptops%20');
    expect(serialized).not.toContain('/demo-store/ Laptops ');
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
