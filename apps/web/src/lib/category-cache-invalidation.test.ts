import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
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

import { invalidateCategoryCaches } from './category-cache-invalidation';

const MERCHANT_ID = 'merchant-1';

describe('invalidateCategoryCaches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.revalidateProducts.mockReturnValue(true);
  });

  it('revalidates both the old and new slug on a rename', () => {
    const result = invalidateCategoryCaches({
      merchantId: MERCHANT_ID,
      previousSlug: 'phones',
      nextSlug: 'mobile-phones',
    });

    expect(mocks.revalidateCategories).toHaveBeenCalledWith(
      MERCHANT_ID,
      'phones'
    );
    expect(mocks.revalidateCategories).toHaveBeenCalledWith(
      MERCHANT_ID,
      'mobile-phones'
    );
    expect(result).toEqual({
      revalidatedSlugs: ['phones', 'mobile-phones'],
      revalidated: true,
    });
  });

  it('deduplicates when the slug did not change', () => {
    invalidateCategoryCaches({
      merchantId: MERCHANT_ID,
      previousSlug: 'phones',
      nextSlug: 'phones',
    });

    expect(mocks.revalidateCategories).toHaveBeenCalledTimes(1);
  });

  it('revalidates child slugs promoted by retirement', () => {
    const result = invalidateCategoryCaches({
      merchantId: MERCHANT_ID,
      previousSlug: 'phones',
      relatedSlugs: ['android', 'ios'],
    });

    for (const slug of ['phones', 'android', 'ios']) {
      expect(mocks.revalidateCategories).toHaveBeenCalledWith(
        MERCHANT_ID,
        slug
      );
    }
    expect(result.revalidatedSlugs).toEqual(['phones', 'android', 'ios']);
  });

  it('falls back to a merchant-wide revalidation when no slug is known', () => {
    invalidateCategoryCaches({ merchantId: MERCHANT_ID });

    expect(mocks.revalidateCategories).toHaveBeenCalledWith(MERCHANT_ID);
  });

  describe('bugfix: product-derived caches also carry category text', () => {
    it('evicts the merchant product and feed tags, not just category tags', () => {
      // Home products, the paginated index and the Google/OpenAI feeds embed
      // joined category names while carrying product-only tags.
      invalidateCategoryCaches({
        merchantId: MERCHANT_ID,
        previousSlug: 'phones',
        nextSlug: 'mobile-phones',
      });

      expect(mocks.revalidateProducts).toHaveBeenCalledWith(
        MERCHANT_ID,
        undefined,
        { feedScope: 'merchant' }
      );
    });

    it('reports partial failure when product-tag invalidation fails', () => {
      mocks.revalidateProducts.mockReturnValue(false);

      const result = invalidateCategoryCaches({
        merchantId: MERCHANT_ID,
        previousSlug: 'phones',
      });

      expect(result.revalidated).toBe(false);
    });

    it('scopes feed eviction to this merchant', () => {
      // 'all' would churn every merchant's feed cache for one category edit.
      invalidateCategoryCaches({
        merchantId: MERCHANT_ID,
        previousSlug: 'phones',
      });

      expect(mocks.revalidateProducts.mock.calls[0]?.[2]).toEqual({
        feedScope: 'merchant',
      });
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
      expect(specifiers).not.toContain('@/lib/cloudflare-purge');
      expect(specifiers).not.toContain('@/lib/cache-revalidation');
    });
  });

  describe('bugfix: a committed mutation must not be reported as a failure', () => {
    it('reports revalidated:false instead of throwing when revalidation fails', () => {
      // The row is ALREADY written by the time this runs. Rethrowing would give
      // the client a 500 for a category that exists, and its retry would then
      // collide with a duplicate-slug 409.
      mocks.revalidateCategories.mockImplementation(() => {
        throw new Error('cache backend unavailable');
      });

      const result = invalidateCategoryCaches({
        merchantId: MERCHANT_ID,
        nextSlug: 'phones',
      });

      expect(result.revalidated).toBe(false);
      expect(mocks.error).toHaveBeenCalled();
    });
  });
});
