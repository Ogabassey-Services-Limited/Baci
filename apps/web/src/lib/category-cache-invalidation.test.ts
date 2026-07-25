import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  revalidateCategories: vi.fn(),
  purgeCloudflareHostnamesConfirmed: vi.fn(),
  buildStorefrontPublicationPurgeHostnames: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  /** Deferred `after()` callbacks, run explicitly to model a flushed response. */
  afterCallbacks: [] as Array<() => unknown>,
}));

vi.mock('next/server', () => ({
  after: (callback: () => unknown) => {
    mocks.afterCallbacks.push(callback);
  },
}));
vi.mock('@/lib/cache-revalidation', () => ({
  revalidateCategories: mocks.revalidateCategories,
}));
vi.mock('@/lib/cloudflare-purge', () => ({
  purgeCloudflareHostnamesConfirmed: mocks.purgeCloudflareHostnamesConfirmed,
}));
vi.mock('@/lib/storefront-publication-purge-hostnames', () => ({
  buildStorefrontPublicationPurgeHostnames:
    mocks.buildStorefrontPublicationPurgeHostnames,
}));
vi.mock('@/lib/logger', () => ({
  logger: { warn: mocks.warn, error: mocks.error },
}));

import { invalidateCategoryCaches } from './category-cache-invalidation';

const MERCHANT_ID = 'merchant-1';
const IDENTIFIERS = ['test-store'];

/** Drain the deferred work the way the runtime does once the response flushes. */
async function flushAfter() {
  const callbacks = [...mocks.afterCallbacks];
  mocks.afterCallbacks.length = 0;
  for (const callback of callbacks) {
    await callback();
  }
}

describe('invalidateCategoryCaches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.afterCallbacks.length = 0;
    mocks.buildStorefrontPublicationPurgeHostnames.mockReturnValue([
      'test-store.baci.app',
    ]);
    mocks.purgeCloudflareHostnamesConfirmed.mockResolvedValue({
      ok: true,
      reason: 'purged',
    });
  });

  it('revalidates both the old and new slug on a rename', async () => {
    const result = invalidateCategoryCaches({
      merchantId: MERCHANT_ID,
      merchantIdentifiers: IDENTIFIERS,
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
    expect(result.revalidatedSlugs).toEqual(['phones', 'mobile-phones']);
    expect(result.revalidated).toBe(true);
    expect(result.edgePurgeScheduled).toBe(true);
  });

  it('deduplicates when the slug did not change', async () => {
    invalidateCategoryCaches({
      merchantId: MERCHANT_ID,
      merchantIdentifiers: IDENTIFIERS,
      previousSlug: 'phones',
      nextSlug: 'phones',
    });

    expect(mocks.revalidateCategories).toHaveBeenCalledTimes(1);
  });

  it('falls back to a merchant-wide revalidation when no slug is known', async () => {
    invalidateCategoryCaches({
      merchantId: MERCHANT_ID,
      merchantIdentifiers: IDENTIFIERS,
    });

    expect(mocks.revalidateCategories).toHaveBeenCalledWith(MERCHANT_ID);
  });

  it('resolves purge hostnames server-side from the merchant identifiers', async () => {
    invalidateCategoryCaches({
      merchantId: MERCHANT_ID,
      merchantIdentifiers: IDENTIFIERS,
      nextSlug: 'phones',
    });
    await flushAfter();

    expect(mocks.buildStorefrontPublicationPurgeHostnames).toHaveBeenCalledWith(
      IDENTIFIERS
    );
    expect(mocks.purgeCloudflareHostnamesConfirmed).toHaveBeenCalledWith([
      'test-store.baci.app',
    ]);
  });

  describe('the purge is deferred off the response path', () => {
    it('does not await the purge before returning', async () => {
      invalidateCategoryCaches({
        merchantId: MERCHANT_ID,
        merchantIdentifiers: IDENTIFIERS,
        nextSlug: 'phones',
      });

      // The 5s-timeout purge must not sit inside the merchant's write latency.
      expect(mocks.purgeCloudflareHostnamesConfirmed).not.toHaveBeenCalled();
      expect(mocks.afterCallbacks).toHaveLength(1);
    });

    it('schedules nothing when no hostname resolves', async () => {
      mocks.buildStorefrontPublicationPurgeHostnames.mockReturnValue([]);

      const result = invalidateCategoryCaches({
        merchantId: MERCHANT_ID,
        merchantIdentifiers: [],
        nextSlug: 'phones',
      });
      await flushAfter();

      expect(mocks.purgeCloudflareHostnamesConfirmed).not.toHaveBeenCalled();
      expect(result.purgeAttemptedHostnames).toEqual([]);
      expect(result.edgePurgeScheduled).toBe(false);
    });
  });

  describe('edge purge is best effort — never fails the mutation', () => {
    it('logs, and does not throw, when the purge provider rejects', async () => {
      mocks.purgeCloudflareHostnamesConfirmed.mockResolvedValue({
        ok: false,
        reason: 'provider_rejected',
      });

      const result = invalidateCategoryCaches({
        merchantId: MERCHANT_ID,
        merchantIdentifiers: IDENTIFIERS,
        nextSlug: 'phones',
      });
      await expect(flushAfter()).resolves.toBeUndefined();

      // Next revalidation still happened — it is the authoritative path.
      expect(result.revalidated).toBe(true);
      expect(mocks.revalidateCategories).toHaveBeenCalled();
      expect(mocks.warn).toHaveBeenCalled();
    });

    it('swallows a throwing purge inside the deferred callback', async () => {
      mocks.purgeCloudflareHostnamesConfirmed.mockRejectedValue(
        new Error('network down')
      );

      expect(
        invalidateCategoryCaches({
          merchantId: MERCHANT_ID,
          merchantIdentifiers: IDENTIFIERS,
          nextSlug: 'phones',
        })
      ).toMatchObject({ edgePurgeScheduled: true });
      await expect(flushAfter()).resolves.toBeUndefined();

      expect(mocks.warn).toHaveBeenCalled();
    });

    it('treats not_required as a non-error no-op', async () => {
      mocks.purgeCloudflareHostnamesConfirmed.mockResolvedValue({
        ok: true,
        reason: 'not_required',
      });

      invalidateCategoryCaches({
        merchantId: MERCHANT_ID,
        merchantIdentifiers: IDENTIFIERS,
        nextSlug: 'phones',
      });
      await flushAfter();

      expect(mocks.warn).not.toHaveBeenCalled();
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

      const result = invalidateCategoryCaches({
        merchantId: MERCHANT_ID,
        merchantIdentifiers: IDENTIFIERS,
        nextSlug: 'phones',
      });

      expect(result.revalidated).toBe(false);
      expect(mocks.error).toHaveBeenCalled();
    });
  });
});
