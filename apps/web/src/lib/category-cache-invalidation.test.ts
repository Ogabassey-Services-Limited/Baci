import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  buildStorefrontPublicationCacheTags: vi.fn(),
  getStorefrontPublicationCacheIdentity: vi.fn(),
  purgeVercelStorefrontPublicationCache: vi.fn(),
  revalidateCategories: vi.fn(),
  revalidateProducts: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/lib/revalidate-categories', () => ({
  revalidateCategories: mocks.revalidateCategories,
}));
vi.mock('@/lib/product-cache-revalidation', () => ({
  productCacheRevalidation: { revalidateProducts: mocks.revalidateProducts },
}));
vi.mock('@/lib/logger', () => ({ logger: { error: mocks.error } }));
vi.mock('@/lib/get-storefront-publication-cache-identity', () => ({
  getStorefrontPublicationCacheIdentity:
    mocks.getStorefrontPublicationCacheIdentity,
}));
vi.mock('@/lib/storefront-publication-cache-tags', () => ({
  buildStorefrontPublicationCacheTags:
    mocks.buildStorefrontPublicationCacheTags,
}));
vi.mock('@/lib/vercel-storefront-publication-cache', () => ({
  purgeVercelStorefrontPublicationCache:
    mocks.purgeVercelStorefrontPublicationCache,
}));

import { invalidateCategoryCaches } from './category-cache-invalidation';

const MERCHANT_ID = 'merchant-1';
const BASE_INPUT = {
  canonicalMerchantSlug: 'merchant-one',
  merchantId: MERCHANT_ID,
  supabase: {} as never,
};

describe('invalidateCategoryCaches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.revalidateProducts.mockReturnValue(true);
    mocks.getStorefrontPublicationCacheIdentity.mockResolvedValue({
      canonicalMerchantSlug: 'merchant-one',
      customDomains: ['merchant.example'],
      identifiers: ['merchant-one', 'merchant.example'],
      merchantId: MERCHANT_ID,
      merchantSlugs: ['merchant-one'],
    });
    mocks.buildStorefrontPublicationCacheTags.mockReturnValue([
      'ps:merchant-one',
      'ph:merchant.example',
    ]);
    mocks.purgeVercelStorefrontPublicationCache.mockResolvedValue({
      ok: true,
      reason: 'deleted',
    });
  });

  it('revalidates both the old and new slug on a rename', async () => {
    const result = await invalidateCategoryCaches({
      ...BASE_INPUT,
      previousSlug: 'phones',
      nextSlug: 'mobile-phones',
    });

    expect(mocks.revalidateCategories).toHaveBeenCalledWith(
      MERCHANT_ID,
      'phones',
      { expireImmediately: true }
    );
    expect(mocks.revalidateCategories).toHaveBeenCalledWith(
      MERCHANT_ID,
      'mobile-phones',
      { expireImmediately: true }
    );
    expect(result).toEqual({
      revalidatedSlugs: ['phones', 'mobile-phones'],
      revalidated: true,
      vercelEvicted: true,
    });
  });

  it('deduplicates when the slug did not change', async () => {
    await invalidateCategoryCaches({
      ...BASE_INPUT,
      previousSlug: 'phones',
      nextSlug: 'phones',
    });

    expect(mocks.revalidateCategories).toHaveBeenCalledTimes(1);
  });

  it('revalidates child slugs promoted by retirement', async () => {
    const result = await invalidateCategoryCaches({
      ...BASE_INPUT,
      previousSlug: 'phones',
      relatedSlugs: ['android', 'ios'],
    });

    for (const slug of ['phones', 'android', 'ios']) {
      expect(mocks.revalidateCategories).toHaveBeenCalledWith(
        MERCHANT_ID,
        slug,
        { expireImmediately: true }
      );
    }
    expect(result.revalidatedSlugs).toEqual(['phones', 'android', 'ios']);
  });

  it('falls back to a merchant-wide revalidation when no slug is known', async () => {
    await invalidateCategoryCaches(BASE_INPUT);

    expect(mocks.revalidateCategories).toHaveBeenCalledWith(
      MERCHANT_ID,
      undefined,
      { expireImmediately: true }
    );
  });

  describe('bugfix: product-derived caches also carry category text', () => {
    it('evicts the merchant product and feed tags, not just category tags', async () => {
      // Home products, the paginated index and the Google/OpenAI feeds embed
      // joined category names while carrying product-only tags.
      await invalidateCategoryCaches({
        ...BASE_INPUT,
        previousSlug: 'phones',
        nextSlug: 'mobile-phones',
      });

      expect(mocks.revalidateProducts).toHaveBeenCalledWith(
        MERCHANT_ID,
        undefined,
        { expireImmediately: true, feedScope: 'merchant' }
      );
    });

    it('reports partial failure when product-tag invalidation fails', async () => {
      mocks.revalidateProducts.mockReturnValue(false);

      const result = await invalidateCategoryCaches({
        ...BASE_INPUT,
        previousSlug: 'phones',
      });

      expect(result.revalidated).toBe(false);
      expect(result.vercelEvicted).toBe(false);
      expect(mocks.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message:
            'Product cache revalidation failed AFTER the mutation committed',
        })
      );
      expect(
        mocks.purgeVercelStorefrontPublicationCache
      ).not.toHaveBeenCalled();
    });

    it('scopes feed eviction to this merchant', async () => {
      // 'all' would churn every merchant's feed cache for one category edit.
      await invalidateCategoryCaches({
        ...BASE_INPUT,
        previousSlug: 'phones',
      });

      expect(mocks.revalidateProducts.mock.calls[0]?.[2]).toEqual({
        expireImmediately: true,
        feedScope: 'merchant',
      });
    });
  });

  describe('bugfix: category mutations evict the active Vercel HTML layer', () => {
    it('hard-expires origin tags before deleting the tenant response tags', async () => {
      await invalidateCategoryCaches({
        ...BASE_INPUT,
        nextSlug: 'phones',
      });

      expect(mocks.revalidateCategories).toHaveBeenCalledWith(
        MERCHANT_ID,
        'phones',
        { expireImmediately: true }
      );
      expect(mocks.getStorefrontPublicationCacheIdentity).toHaveBeenCalledWith(
        BASE_INPUT.supabase,
        MERCHANT_ID,
        'merchant-one'
      );
      expect(mocks.purgeVercelStorefrontPublicationCache).toHaveBeenCalledWith([
        'ps:merchant-one',
        'ph:merchant.example',
      ]);
      expect(
        mocks.revalidateCategories.mock.invocationCallOrder[0]
      ).toBeLessThan(
        mocks.purgeVercelStorefrontPublicationCache.mock.invocationCallOrder[0]
      );
    });

    it('resolves the cache identity when the owner has no canonical slug', async () => {
      await invalidateCategoryCaches({
        ...BASE_INPUT,
        canonicalMerchantSlug: null,
        nextSlug: 'phones',
      });

      expect(mocks.getStorefrontPublicationCacheIdentity).toHaveBeenCalledWith(
        BASE_INPUT.supabase,
        MERCHANT_ID,
        null
      );
      expect(mocks.buildStorefrontPublicationCacheTags).toHaveBeenCalledWith({
        customDomains: ['merchant.example'],
        merchantSlugs: ['merchant-one'],
      });
    });

    it('reports Vercel deletion failure without hiding the committed mutation', async () => {
      mocks.purgeVercelStorefrontPublicationCache.mockResolvedValue({
        ok: false,
        reason: 'request_failed',
      });

      const result = await invalidateCategoryCaches({
        ...BASE_INPUT,
        nextSlug: 'phones',
      });

      expect(result.vercelEvicted).toBe(false);
      expect(mocks.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message:
            'Category Vercel cache eviction failed AFTER the mutation committed',
        })
      );
    });
  });

  describe('the credential-authority boundary is respected', () => {
    it('imports no module that reaches the Cloudflare token', async () => {
      // A static import of `cloudflare-purge` (which reads
      // getCloudflareApiToken) would put a credential authority into the
      // category API routes' import graph and fail the event-pipeline boundary
      // gate. This is the cheap local guard for that contract.
      const { readFileSync } = await import('node:fs');
      const { join } = await import('node:path');
      const source = readFileSync(
        join(import.meta.dirname, 'category-cache-invalidation.ts'),
        'utf8'
      );

      // Capture both multi-line `from` imports and side-effect imports so a
      // formatting change cannot hide a credential-reaching specifier.
      const specifiers = Array.from(
        source.matchAll(/(?:from\s+|import\s*)['"]([^'"]+)['"]/g)
      ).map((match) => match[1]);
      for (const forbiddenSpecifier of [
        /cloudflare-purge/,
        /(?:^|\/)cache-revalidation(?:$|[-/])/,
      ]) {
        expect(
          specifiers.filter((specifier) => forbiddenSpecifier.test(specifier))
        ).toEqual([]);
      }
    });
  });

  describe('bugfix: a committed mutation must not be reported as a failure', () => {
    it('reports revalidated:false instead of throwing when revalidation fails', async () => {
      // The row is ALREADY written by the time this runs. Rethrowing would give
      // the client a 500 for a category that exists, and its retry would then
      // collide with a duplicate-slug 409.
      mocks.revalidateCategories.mockImplementation(() => {
        throw new Error('cache backend unavailable');
      });

      const result = await invalidateCategoryCaches({
        ...BASE_INPUT,
        nextSlug: 'phones',
      });

      expect(result.revalidated).toBe(false);
      expect(result.vercelEvicted).toBe(false);
      expect(
        mocks.purgeVercelStorefrontPublicationCache
      ).not.toHaveBeenCalled();
      expect(mocks.error).toHaveBeenCalled();
    });
  });
});
