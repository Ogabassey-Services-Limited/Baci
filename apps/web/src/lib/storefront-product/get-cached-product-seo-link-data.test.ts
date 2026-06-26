import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCachedProductSeoLinkData } from './get-cached-product-seo-link-data';

const mocks = vi.hoisted(() => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  getUncachedProductSeoLinkData: vi.fn(),
}));

vi.mock('next/cache', () => ({
  cacheLife: (...args: string[]) => mocks.cacheLife(...args),
  cacheTag: (...args: string[]) => mocks.cacheTag(...args),
}));

vi.mock('./get-product-seo-link-direct-data', () => ({
  getUncachedProductSeoLinkData: (
    merchantId: string,
    categorySlug: string,
    productId: string
  ) => mocks.getUncachedProductSeoLinkData(merchantId, categorySlug, productId),
}));

const moduleDir = dirname(fileURLToPath(import.meta.url));
const source = [
  'get-cached-product-seo-link-data.ts',
  'get-product-seo-link-direct-data.ts',
  'get-product-seo-link-guides.ts',
  'get-product-seo-link-inventory.ts',
]
  .map((file) => readFileSync(join(moduleDir, file), 'utf8'))
  .join('\n');

const seoLinkData = {
  inventory: [],
  guidePosts: [],
  priorityGuidePostSlugs: [],
};

describe('getCachedProductSeoLinkData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUncachedProductSeoLinkData.mockResolvedValue(seoLinkData);
  });

  it('keeps SEO link enrichment off the remote cache handler and remote helpers', () => {
    expect(source).toContain("'use cache';");
    expect(source).not.toContain("'use cache: remote';");
    expect(source).not.toContain('getCachedCategoryPageData');
    expect(source).not.toContain('getPublishedClusterPosts');
    expect(source).not.toContain('getPublishedProductGuidePosts');
    expect(source).toContain('getCachedFeatureSettings');
  });

  it('tags the local cache and delegates to direct reads', async () => {
    const result = await getCachedProductSeoLinkData(
      'merchant-1',
      'laptops',
      'ogabassey',
      'prod-1'
    );

    expect(result).toBe(seoLinkData);
    expect(mocks.cacheLife).toHaveBeenCalledWith('products');
    expect(mocks.cacheTag).toHaveBeenCalledWith(
      'products',
      'products-merchant-1',
      'blog-posts',
      'seo-links-merchant-1-laptops-prod-1'
    );
    expect(mocks.getUncachedProductSeoLinkData).toHaveBeenCalledWith(
      'merchant-1',
      'laptops',
      'prod-1'
    );
  });

  it('continues when Next cache APIs are unavailable in a unit-test runtime', async () => {
    mocks.cacheLife.mockImplementationOnce(() => {
      throw new Error('cache unavailable');
    });

    await expect(
      getCachedProductSeoLinkData(
        'merchant-1',
        'laptops',
        'ogabassey',
        'prod-1'
      )
    ).resolves.toBe(seoLinkData);
  });
});
