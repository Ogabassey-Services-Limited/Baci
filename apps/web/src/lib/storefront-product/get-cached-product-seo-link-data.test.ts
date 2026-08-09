import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCachedProductSeoLinkData } from './get-cached-product-seo-link-data';

const mocks = vi.hoisted(() => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  client: { rpc: vi.fn() },
  readStorefrontPdpSemanticEnrichment: vi.fn(),
}));

vi.mock('next/cache', () => ({
  cacheLife: (...args: string[]) => mocks.cacheLife(...args),
  cacheTag: (...args: string[]) => mocks.cacheTag(...args),
}));

vi.mock('@/lib/cached-data', () => ({
  getPublicSupabaseClient: () => mocks.client,
}));

vi.mock('./storefront-pdp-semantic-enrichment', () => ({
  readStorefrontPdpSemanticEnrichment: (...args: unknown[]) =>
    mocks.readStorefrontPdpSemanticEnrichment(...args),
}));

const moduleDir = dirname(fileURLToPath(import.meta.url));
const source = [
  'get-cached-product-seo-link-data.ts',
  'storefront-pdp-semantic-enrichment.ts',
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
    mocks.readStorefrontPdpSemanticEnrichment.mockResolvedValue({
      status: 'found',
      value: seoLinkData,
    });
  });

  it('keeps SEO link enrichment off the remote cache handler and remote helpers', () => {
    expect(source).toContain("'use cache';");
    expect(source).not.toContain("'use cache: remote';");
    expect(source).not.toContain('getCachedCategoryPageData');
    expect(source).not.toContain('getPublishedClusterPosts');
    expect(source).not.toContain('getPublishedProductGuidePosts');
    expect(source).not.toContain('getCachedFeatureSettings');
  });

  it('tags the local cache and delegates to one semantic snapshot', async () => {
    const result = await getCachedProductSeoLinkData(
      'merchant-1',
      'laptops',
      'prod-1',
      'legion-5',
      'Lenovo Legion 5',
      'Lenovo',
      true
    );

    expect(result).toBe(seoLinkData);
    expect(mocks.cacheLife).toHaveBeenCalledWith('products');
    expect(mocks.cacheTag).toHaveBeenCalledWith(
      'products',
      'products-merchant-1',
      'blog-posts',
      'seo-links-merchant-1-laptops-prod-1'
    );
    expect(mocks.readStorefrontPdpSemanticEnrichment).toHaveBeenCalledWith(
      mocks.client,
      expect.objectContaining({
        clusterRequest: expect.objectContaining({
          p_category_slug: 'laptops',
          p_search_query: expect.stringContaining('"lenovo legion 5"'),
        }),
        includeGuides: true,
        merchantId: 'merchant-1',
        productId: 'prod-1',
      })
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
        'prod-1',
        'legion-5',
        'Lenovo Legion 5',
        'Lenovo',
        true
      )
    ).resolves.toBe(seoLinkData);
  });

  it('throws transient snapshot failures before an empty enrichment can be cached', async () => {
    mocks.readStorefrontPdpSemanticEnrichment.mockResolvedValueOnce({
      status: 'unavailable',
      error: {
        code: '57014',
        kind: 'timeout',
        operation: 'pdp_semantic_enrichment',
        retryable: true,
      },
    });

    await expect(
      getCachedProductSeoLinkData(
        'merchant-1',
        'laptops',
        'prod-1',
        'legion-5',
        'Lenovo Legion 5',
        'Lenovo',
        true
      )
    ).rejects.toMatchObject({
      failure: expect.objectContaining({ code: '57014' }),
    });
  });

  it('caches a genuine enrichment miss as an explicit empty optional model', async () => {
    mocks.readStorefrontPdpSemanticEnrichment.mockResolvedValueOnce({
      status: 'not_found',
    });

    await expect(
      getCachedProductSeoLinkData(
        'merchant-1',
        'laptops',
        'missing-product',
        'missing-product',
        'Missing Product',
        null,
        true
      )
    ).resolves.toEqual(seoLinkData);
  });
});
