import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCachedProductSeoLinkData } from './get-cached-product-seo-link-data';

const mockGetCachedCategoryPageData = vi.fn();
const mockGetPublishedClusterPosts = vi.fn();

// cacheLife/cacheTag throw outside Next's cacheComponents runtime; no-op them.
vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));

vi.mock('@/lib/cached-data', () => ({
  getCachedCategoryPageData: (...args: unknown[]) =>
    mockGetCachedCategoryPageData(...args),
}));

vi.mock('@/lib/storefront-content/get-published-cluster-posts', () => ({
  getPublishedClusterPosts: (...args: unknown[]) =>
    mockGetPublishedClusterPosts(...args),
}));

const products = [
  { slug: 'macbook-pro', name: 'MacBook Pro', price: 4_500_000 },
];
const guidePosts = [{ slug: 'best-laptops', title: 'Best laptops' }];

describe('getCachedProductSeoLinkData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPublishedClusterPosts.mockResolvedValue(guidePosts);
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
      'ogabassey'
    );

    expect(mockGetCachedCategoryPageData).toHaveBeenCalledWith(
      'merchant-1',
      'laptops',
      'ogabassey'
    );
    expect(result).toEqual({ inventory: products, guidePosts });
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
    expect(result.guidePosts).toEqual(guidePosts);
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
