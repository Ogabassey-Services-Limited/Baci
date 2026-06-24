import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getUncachedProductSeoLinkData } from './get-product-seo-link-direct-data';

const mocks = vi.hoisted(() => ({
  getProductSeoInventory: vi.fn(),
  getSeoGuidePosts: vi.fn(),
}));

vi.mock('./get-product-seo-link-inventory', () => ({
  getProductSeoInventory: (
    merchantId: string,
    categorySlug: string,
    productId: string
  ) => mocks.getProductSeoInventory(merchantId, categorySlug, productId),
}));

vi.mock('./get-product-seo-link-guides', () => ({
  getSeoGuidePosts: (
    merchantId: string,
    productId: string,
    categorySlug: string
  ) => mocks.getSeoGuidePosts(merchantId, productId, categorySlug),
}));

describe('getUncachedProductSeoLinkData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getProductSeoInventory.mockResolvedValue([]);
    mocks.getSeoGuidePosts.mockResolvedValue({
      clusterGuidePosts: [{ slug: 'best-laptops', title: 'Best laptops' }],
      productGuidePosts: [
        { slug: 'legion-guide', title: 'Legion guide' },
        { slug: 'best-laptops', title: 'Best laptops duplicate' },
      ],
    });
  });

  it('loads inventory and guide posts in parallel and merges priority guides first', async () => {
    let resolveInventory: (value: unknown[]) => void = () => undefined;
    mocks.getProductSeoInventory.mockReturnValue(
      new Promise((resolve) => {
        resolveInventory = resolve;
      })
    );

    const resultPromise = getUncachedProductSeoLinkData(
      'merchant-1',
      'laptops',
      'prod-1'
    );

    await Promise.resolve();

    expect(mocks.getSeoGuidePosts).toHaveBeenCalledWith(
      'merchant-1',
      'prod-1',
      'laptops'
    );
    resolveInventory([{ slug: 'macbook-pro', name: 'MacBook Pro', price: 1 }]);

    await expect(resultPromise).resolves.toEqual({
      inventory: [{ slug: 'macbook-pro', name: 'MacBook Pro', price: 1 }],
      guidePosts: [
        { slug: 'legion-guide', title: 'Legion guide' },
        { slug: 'best-laptops', title: 'Best laptops duplicate' },
      ],
      priorityGuidePostSlugs: ['legion-guide', 'best-laptops'],
    });
  });

  it('rejects when strict inventory loading fails so degraded SEO links are not cached', async () => {
    mocks.getProductSeoInventory.mockRejectedValueOnce(
      new Error('inventory unavailable')
    );

    await expect(
      getUncachedProductSeoLinkData('merchant-1', 'laptops', 'prod-1')
    ).rejects.toThrow('inventory unavailable');
  });
});
