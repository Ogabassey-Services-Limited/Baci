import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCachedProductSeoLinkData } from './get-cached-product-seo-link-data';

const mockGetCachedCategoryPageData = vi.fn();
const mockGetPublishedClusterPosts = vi.fn();
const mockGetPublishedProductGuidePosts = vi.fn();
const mockCacheLife = vi.fn();
const mockCacheTag = vi.fn();

// cacheLife/cacheTag throw outside Next's cacheComponents runtime; no-op them.
vi.mock('next/cache', () => ({
  cacheLife: (...args: string[]) => mockCacheLife(...args),
  cacheTag: (...args: string[]) => mockCacheTag(...args),
}));

vi.mock('@/lib/cached-data', () => ({
  getCachedCategoryPageData: (...args: unknown[]) =>
    mockGetCachedCategoryPageData(...args),
}));

vi.mock('@/lib/storefront-content/get-published-cluster-posts', () => ({
  getPublishedClusterPosts: (...args: unknown[]) =>
    mockGetPublishedClusterPosts(...args),
}));

vi.mock('@/lib/storefront-content/get-published-product-guide-posts', () => ({
  getPublishedProductGuidePosts: (...args: unknown[]) =>
    mockGetPublishedProductGuidePosts(...args),
}));

const products = [
  { slug: 'macbook-pro', name: 'MacBook Pro', price: 4_500_000 },
];
const guidePosts = [{ slug: 'best-laptops', title: 'Best laptops' }];
const productGuidePosts = [
  { slug: 'lenovo-legion-guide', title: 'Lenovo Legion Guide' },
  { slug: 'best-laptops', title: 'Best laptops' },
];

describe('getCachedProductSeoLinkData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPublishedClusterPosts.mockResolvedValue(guidePosts);
    mockGetPublishedProductGuidePosts.mockResolvedValue(productGuidePosts);
  });

  it('returns inventory + guide posts on a successful fetch', async () => {
    mockGetCachedCategoryPageData.mockResolvedValue({
      isCollection: false,
      products,
      productsQueryFailed: false,
    });

    const result = await getCachedProductSeoLinkData(
      'merchant-1',
      'laptops',
      'ogabassey',
      'prod-1'
    );

    expect(mockGetCachedCategoryPageData).toHaveBeenCalledWith(
      'merchant-1',
      'laptops',
      'ogabassey'
    );
    expect(mockGetPublishedProductGuidePosts).toHaveBeenCalledWith(
      'merchant-1',
      'prod-1'
    );
    expect(result).toEqual({
      inventory: products,
      guidePosts: [
        { slug: 'lenovo-legion-guide', title: 'Lenovo Legion Guide' },
        { slug: 'best-laptops', title: 'Best laptops' },
      ],
      priorityGuidePostSlugs: ['lenovo-legion-guide', 'best-laptops'],
    });
    expect(mockCacheTag).toHaveBeenCalledWith(
      'products',
      'products-merchant-1',
      'blog-posts',
      'seo-links-merchant-1-laptops-prod-1'
    );
  });

  it('continues when Next cache APIs are unavailable in a unit-test runtime', async () => {
    mockCacheLife.mockImplementationOnce(() => {
      throw new Error('cache unavailable');
    });
    mockGetCachedCategoryPageData.mockResolvedValue({
      isCollection: false,
      products,
      productsQueryFailed: false,
    });

    await expect(
      getCachedProductSeoLinkData(
        'merchant-1',
        'laptops',
        'ogabassey',
        'prod-1'
      )
    ).resolves.toMatchObject({ inventory: products });
  });

  it('THROWS on a transient inventory failure so the degraded result is never cached', async () => {
    mockGetCachedCategoryPageData.mockResolvedValue({
      isCollection: false,
      products: [],
      productsQueryFailed: true,
    });

    await expect(
      getCachedProductSeoLinkData('merchant-1', 'laptops', 'ogabassey')
    ).rejects.toThrow(/transient/i);
  });

  it('THROWS on a transient category lookup failure so fallback inventory is never cached', async () => {
    mockGetCachedCategoryPageData.mockResolvedValue({
      isCollection: false,
      products,
      productsQueryFailed: false,
      categoryQueryFailed: true,
    });

    await expect(
      getCachedProductSeoLinkData('merchant-1', 'laptops', 'ogabassey')
    ).rejects.toThrow(/transient/i);
  });

  it('returns empty inventory for a collection category (still cacheable)', async () => {
    mockGetCachedCategoryPageData.mockResolvedValue({
      isCollection: true,
      products,
      productsQueryFailed: false,
    });

    const result = await getCachedProductSeoLinkData(
      'merchant-1',
      'laptops',
      'ogabassey'
    );

    expect(result.inventory).toEqual([]);
    expect(result.guidePosts).toEqual([
      { slug: 'lenovo-legion-guide', title: 'Lenovo Legion Guide' },
      { slug: 'best-laptops', title: 'Best laptops' },
    ]);
    expect(result.priorityGuidePostSlugs).toEqual([
      'lenovo-legion-guide',
      'best-laptops',
    ]);
  });

  it('treats a genuinely empty category (no error) as a cacheable empty result', async () => {
    mockGetCachedCategoryPageData.mockResolvedValue({
      isCollection: false,
      products: [],
      productsQueryFailed: false,
    });

    const result = await getCachedProductSeoLinkData(
      'merchant-1',
      'laptops',
      'ogabassey'
    );

    expect(result.inventory).toEqual([]);
  });
});
