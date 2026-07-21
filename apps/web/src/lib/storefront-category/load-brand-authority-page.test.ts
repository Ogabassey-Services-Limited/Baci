import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetMerchantByIdentifier = vi.fn();
const mockGetCachedCategoryPageData = vi.fn();

vi.mock('next/headers', () => ({
  headers: () => Promise.resolve(new Headers()),
}));

vi.mock('@/lib/cached-data', () => ({
  getMerchantByIdentifier: (...args: unknown[]) =>
    mockGetMerchantByIdentifier(...args),
  getCachedCategoryPageData: (...args: unknown[]) =>
    mockGetCachedCategoryPageData(...args),
}));

vi.mock('@/lib/normalize-product', () => ({
  normalizeProduct: (product: unknown) => product,
}));

vi.mock('@/lib/store-url', () => ({
  buildStoreUrl: () => 'https://ogabassey.com',
}));

vi.mock('@/lib/storefront-content/load-published-cluster-posts-safely', () => ({
  loadPublishedClusterPostsSafely: () => Promise.resolve([]),
}));

function makeProduct(index: number, brand = 'Samsung') {
  return {
    id: `product-${index}`,
    name: `${brand} Phone ${index}`,
    slug: `${brand.toLowerCase()}-phone-${index}`,
    category: 'Smartphones',
    category_slug: 'smartphones',
    brand,
    price: 100_000 + index,
    condition: 'new',
    stock: 2,
    availability: 'InStock' as const,
    has_condition_offers: false,
    product_key_specs: null,
    image: 'https://cdn.example.com/phone.jpg',
    description: 'Phone description',
  };
}

describe('loadBrandAuthorityPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMerchantByIdentifier.mockResolvedValue({
      id: 'merchant-1',
      slug: 'ogabassey',
      business_name: 'Ogabassey',
      country: 'NG',
    });
    mockGetCachedCategoryPageData.mockResolvedValue({
      isCollection: false,
      isInactiveCategory: false,
      productsQueryFailed: false,
      fallbackName: 'Smartphones',
      products: Array.from({ length: 6 }, (_, index) => makeProduct(index)),
    });
  });

  it('builds a canonical indexable hub from matching active inventory', async () => {
    const { brandAuthorityPageLoader } = await import(
      './load-brand-authority-page'
    );
    const page = await brandAuthorityPageLoader.load(
      {
        merchantSlug: 'ogabassey',
        categorySlug: 'smartphones',
        brandSlug: 'samsung',
      },
      { includeRequestPathPrefix: false }
    );

    expect(page).toMatchObject({
      canonicalUrl: 'https://ogabassey.com/smartphones/brands/samsung',
      heading: 'Samsung Phones and Prices in Nigeria',
      categoryName: 'Smartphones',
      pathPrefix: '',
    });
    expect(page?.products).toHaveLength(6);
    expect(page?.breadcrumbItems).toHaveLength(3);
  });

  it('rejects uncurated and thin brand pages', async () => {
    const { brandAuthorityPageLoader } = await import(
      './load-brand-authority-page'
    );

    await expect(
      brandAuthorityPageLoader.load({
        merchantSlug: 'ogabassey',
        categorySlug: 'smartphones',
        brandSlug: 'unknown',
      })
    ).resolves.toBeNull();

    mockGetCachedCategoryPageData.mockResolvedValueOnce({
      isCollection: false,
      isInactiveCategory: false,
      productsQueryFailed: false,
      fallbackName: 'Smartphones',
      products: Array.from({ length: 4 }, (_, index) => makeProduct(index)),
    });

    await expect(
      brandAuthorityPageLoader.load({
        merchantSlug: 'ogabassey',
        categorySlug: 'smartphones',
        brandSlug: 'samsung',
      })
    ).resolves.toBeNull();
  });
});
