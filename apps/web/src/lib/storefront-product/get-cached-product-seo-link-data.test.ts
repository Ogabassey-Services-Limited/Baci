import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCachedProductSeoLinkData } from './get-cached-product-seo-link-data';

const mockGetCachedProductSemanticInventory = vi.fn();
const mockGetPublishedClusterPosts = vi.fn();
const mockGetPublishedProductGuidePosts = vi.fn();
const mockCacheLife = vi.fn();
const mockCacheTag = vi.fn();

// cacheLife/cacheTag throw outside Next's cacheComponents runtime; no-op them.
vi.mock('next/cache', () => ({
  cacheLife: (...args: string[]) => mockCacheLife(...args),
  cacheTag: (...args: string[]) => mockCacheTag(...args),
}));

vi.mock(
  '@/lib/storefront-product/get-cached-product-semantic-inventory',
  () => ({
    getCachedProductSemanticInventory: (...args: unknown[]) =>
      mockGetCachedProductSemanticInventory(...args),
  })
);

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
const source = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    'get-cached-product-seo-link-data.ts'
  ),
  'utf8'
);

describe('getCachedProductSeoLinkData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCachedProductSemanticInventory.mockResolvedValue(products);
    mockGetPublishedClusterPosts.mockResolvedValue(guidePosts);
    mockGetPublishedProductGuidePosts.mockResolvedValue(productGuidePosts);
  });

  it('keeps SEO link enrichment off the remote cache handler', () => {
    expect(source).toContain("'use cache';");
    expect(source).not.toContain("'use cache: remote';");
  });

  it('returns inventory + guide posts on a successful fetch', async () => {
    const result = await getCachedProductSeoLinkData(
      'merchant-1',
      'laptops',
      'ogabassey',
      'prod-1'
    );

    expect(mockGetCachedProductSemanticInventory).toHaveBeenCalledWith(
      'merchant-1',
      'laptops'
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
    expect(mockCacheLife).toHaveBeenCalledWith('products');
  });

  it('continues when Next cache APIs are unavailable in a unit-test runtime', async () => {
    mockCacheLife.mockImplementationOnce(() => {
      throw new Error('cache unavailable');
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

  it('throws on a transient inventory failure so the degraded result is never cached', async () => {
    mockGetCachedProductSemanticInventory.mockRejectedValue(
      new Error('Product SEO link inventory unavailable (transient)')
    );

    await expect(
      getCachedProductSeoLinkData('merchant-1', 'laptops', 'ogabassey')
    ).rejects.toThrow(/transient/i);
  });

  it('treats a genuinely empty category as a cacheable empty result', async () => {
    mockGetCachedProductSemanticInventory.mockResolvedValue([]);
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
});
