import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCachedProductSeoLinkData } from './get-cached-product-seo-link-data';
import { storefrontPdpSemanticReadCooldown } from './storefront-pdp-semantic-read-cooldown-singleton';

const mocks = vi.hoisted(() => ({
  getCachedPdpProductGuidePosts: vi.fn(),
  getCachedPdpSemanticInventory: vi.fn(),
  getPublishedClusterPosts: vi.fn(),
}));

vi.mock('./get-cached-pdp-product-guide-posts', () => ({
  getCachedPdpProductGuidePosts: (...args: unknown[]) =>
    mocks.getCachedPdpProductGuidePosts(...args),
}));

vi.mock('./get-cached-pdp-semantic-inventory', () => ({
  getCachedPdpSemanticInventory: (...args: unknown[]) =>
    mocks.getCachedPdpSemanticInventory(...args),
}));

vi.mock('@/lib/storefront-content/get-published-cluster-posts', () => ({
  getPublishedClusterPosts: (...args: unknown[]) =>
    mocks.getPublishedClusterPosts(...args),
}));

const inventory = [
  {
    category_slug: 'laptops',
    name: 'MacBook Pro',
    price: 4500000,
    slug: 'macbook-pro',
  },
];
const productGuidePosts = [
  { slug: 'lenovo-legion-guide', title: 'Lenovo Legion Guide' },
];
const clusterGuidePosts = [
  {
    category: 'Laptops',
    excerpt: 'Duplicate linked guide',
    featured_image_url: null,
    keywords: ['lenovo'],
    published_at: '2026-08-31T10:00:00.000Z',
    reading_time_minutes: 5,
    slug: 'lenovo-legion-guide',
    tags: ['laptops'],
    title: 'Duplicate linked guide',
  },
  {
    category: 'Laptops',
    excerpt: 'Best laptops',
    featured_image_url: null,
    keywords: ['laptops'],
    published_at: '2026-08-30T10:00:00.000Z',
    reading_time_minutes: 5,
    slug: 'best-laptops',
    tags: ['laptops'],
    title: 'Best laptops',
  },
];

describe('getCachedProductSeoLinkData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storefrontPdpSemanticReadCooldown.reset();
    mocks.getCachedPdpSemanticInventory.mockResolvedValue(inventory);
    mocks.getCachedPdpProductGuidePosts.mockResolvedValue(productGuidePosts);
    mocks.getPublishedClusterPosts.mockResolvedValue(clusterGuidePosts);
  });

  it('reuses category inventory and independently merges linked guide priority', async () => {
    const result = await getCachedProductSeoLinkData(
      'merchant-1',
      'laptops',
      'ogabassey',
      'prod-1',
      'legion-5',
      'Lenovo Legion 5',
      'Lenovo',
      true
    );

    expect(result).toEqual({
      inventory,
      guidePosts: [productGuidePosts[0], clusterGuidePosts[1]],
      priorityGuidePostSlugs: ['lenovo-legion-guide'],
    });
    expect(mocks.getCachedPdpSemanticInventory).toHaveBeenCalledWith(
      'merchant-1',
      'laptops',
      'ogabassey'
    );
    expect(mocks.getPublishedClusterPosts).toHaveBeenCalledWith(
      'merchant-1',
      expect.objectContaining({
        brands: ['Lenovo'],
        categorySlug: 'laptops',
        pageKind: 'product',
        productNames: ['Lenovo Legion 5'],
        productSlugs: ['legion-5'],
      })
    );
    expect(mocks.getCachedPdpProductGuidePosts).toHaveBeenCalledWith(
      'merchant-1',
      'prod-1'
    );
  });

  it('does not query guide data when the merchant blog is disabled', async () => {
    await expect(
      getCachedProductSeoLinkData(
        'merchant-1',
        'laptops',
        'ogabassey',
        'prod-1',
        'legion-5',
        'Lenovo Legion 5',
        'Lenovo',
        false
      )
    ).resolves.toEqual({
      inventory,
      guidePosts: [],
      priorityGuidePostSlugs: [],
    });

    expect(mocks.getPublishedClusterPosts).not.toHaveBeenCalled();
    expect(mocks.getCachedPdpProductGuidePosts).not.toHaveBeenCalled();
  });

  it('skips a repeated inventory timeout while the shared cooldown is active', async () => {
    mocks.getCachedPdpSemanticInventory.mockRejectedValueOnce(
      new DOMException('inventory timed out', 'TimeoutError')
    );

    await expect(
      getCachedProductSeoLinkData(
        'merchant-1',
        'laptops',
        'ogabassey',
        'prod-1',
        'legion-5',
        'Lenovo Legion 5',
        'Lenovo',
        false
      )
    ).rejects.toMatchObject({ name: 'TimeoutError' });
    await expect(
      getCachedProductSeoLinkData(
        'merchant-1',
        'laptops',
        'ogabassey',
        'prod-1',
        'legion-5',
        'Lenovo Legion 5',
        'Lenovo',
        false
      )
    ).resolves.toMatchObject({ inventory: [] });
    expect(mocks.getCachedPdpSemanticInventory).toHaveBeenCalledTimes(1);
  });

  it('keeps the PDP optional model usable when a guide read times out', async () => {
    mocks.getPublishedClusterPosts.mockRejectedValueOnce(
      new Error('cluster guide timeout')
    );
    mocks.getCachedPdpProductGuidePosts.mockRejectedValueOnce(
      new Error('product guide timeout')
    );
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // Suppress expected optional guide fallback warnings.
    });

    await expect(
      getCachedProductSeoLinkData(
        'merchant-1',
        'laptops',
        'ogabassey',
        'prod-1',
        'legion-5',
        'Lenovo Legion 5',
        'Lenovo',
        true
      )
    ).resolves.toEqual({
      inventory,
      guidePosts: [],
      priorityGuidePostSlugs: [],
    });

    expect(warnSpy).toHaveBeenCalledTimes(2);
    warnSpy.mockRestore();
  });

  it('drops malformed cluster guide rows instead of failing the PDP', async () => {
    mocks.getPublishedClusterPosts.mockResolvedValueOnce([
      {
        ...clusterGuidePosts[1],
        tags: 'not-an-array',
      },
    ]);

    await expect(
      getCachedProductSeoLinkData(
        'merchant-1',
        'laptops',
        'ogabassey',
        'prod-1',
        'legion-5',
        'Lenovo Legion 5',
        'Lenovo',
        true
      )
    ).resolves.toEqual({
      inventory,
      guidePosts: productGuidePosts,
      priorityGuidePostSlugs: ['lenovo-legion-guide'],
    });
  });

  it('lets inventory failures escape so the component can omit only the optional section', async () => {
    mocks.getCachedPdpSemanticInventory.mockRejectedValueOnce(
      new Error('inventory timeout')
    );

    await expect(
      getCachedProductSeoLinkData(
        'merchant-1',
        'laptops',
        'ogabassey',
        'prod-1',
        'legion-5',
        'Lenovo Legion 5',
        'Lenovo',
        true
      )
    ).rejects.toThrow('inventory timeout');

    expect(mocks.getPublishedClusterPosts).not.toHaveBeenCalled();
    expect(mocks.getCachedPdpProductGuidePosts).not.toHaveBeenCalled();
  });
});
