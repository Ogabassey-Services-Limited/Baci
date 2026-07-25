import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  revalidateCategories: vi.fn(),
  purgeCloudflareHostnamesConfirmed: vi.fn(),
  buildStorefrontPublicationPurgeHostnames: vi.fn(),
  warn: vi.fn(),
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
vi.mock('@/lib/logger', () => ({ logger: { warn: mocks.warn } }));

import { invalidateCategoryCaches } from './category-cache-invalidation';

const MERCHANT_ID = 'merchant-1';
const IDENTIFIERS = ['test-store'];

describe('invalidateCategoryCaches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.buildStorefrontPublicationPurgeHostnames.mockReturnValue([
      'test-store.baci.app',
    ]);
    mocks.purgeCloudflareHostnamesConfirmed.mockResolvedValue({
      ok: true,
      reason: 'purged',
    });
  });

  it('revalidates both the old and new slug on a rename', async () => {
    const result = await invalidateCategoryCaches({
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
    expect(result.edgePurgeDelivered).toBe(true);
  });

  it('deduplicates when the slug did not change', async () => {
    await invalidateCategoryCaches({
      merchantId: MERCHANT_ID,
      merchantIdentifiers: IDENTIFIERS,
      previousSlug: 'phones',
      nextSlug: 'phones',
    });

    expect(mocks.revalidateCategories).toHaveBeenCalledTimes(1);
  });

  it('falls back to a merchant-wide revalidation when no slug is known', async () => {
    await invalidateCategoryCaches({
      merchantId: MERCHANT_ID,
      merchantIdentifiers: IDENTIFIERS,
    });

    expect(mocks.revalidateCategories).toHaveBeenCalledWith(MERCHANT_ID);
  });

  it('resolves purge hostnames server-side from the merchant identifiers', async () => {
    await invalidateCategoryCaches({
      merchantId: MERCHANT_ID,
      merchantIdentifiers: IDENTIFIERS,
      nextSlug: 'phones',
    });

    expect(mocks.buildStorefrontPublicationPurgeHostnames).toHaveBeenCalledWith(
      IDENTIFIERS
    );
    expect(mocks.purgeCloudflareHostnamesConfirmed).toHaveBeenCalledWith([
      'test-store.baci.app',
    ]);
  });

  describe('edge purge is best effort — never fails the mutation', () => {
    it('resolves when the purge provider rejects', async () => {
      mocks.purgeCloudflareHostnamesConfirmed.mockResolvedValue({
        ok: false,
        reason: 'provider_rejected',
      });

      const result = await invalidateCategoryCaches({
        merchantId: MERCHANT_ID,
        merchantIdentifiers: IDENTIFIERS,
        nextSlug: 'phones',
      });

      expect(result.edgePurgeDelivered).toBe(false);
      // Next revalidation still happened — it is the authoritative path.
      expect(mocks.revalidateCategories).toHaveBeenCalled();
      expect(mocks.warn).toHaveBeenCalled();
    });

    it('resolves when the purge throws', async () => {
      mocks.purgeCloudflareHostnamesConfirmed.mockRejectedValue(
        new Error('network down')
      );

      await expect(
        invalidateCategoryCaches({
          merchantId: MERCHANT_ID,
          merchantIdentifiers: IDENTIFIERS,
          nextSlug: 'phones',
        })
      ).resolves.toMatchObject({ edgePurgeDelivered: false });
      expect(mocks.warn).toHaveBeenCalled();
    });

    it('treats not_required as a non-error no-op', async () => {
      mocks.purgeCloudflareHostnamesConfirmed.mockResolvedValue({
        ok: true,
        reason: 'not_required',
      });

      const result = await invalidateCategoryCaches({
        merchantId: MERCHANT_ID,
        merchantIdentifiers: IDENTIFIERS,
        nextSlug: 'phones',
      });

      expect(result.edgePurgeDelivered).toBe(false);
      expect(mocks.warn).not.toHaveBeenCalled();
    });

    it('skips the purge entirely when no hostname resolves', async () => {
      mocks.buildStorefrontPublicationPurgeHostnames.mockReturnValue([]);

      const result = await invalidateCategoryCaches({
        merchantId: MERCHANT_ID,
        merchantIdentifiers: [],
        nextSlug: 'phones',
      });

      expect(mocks.purgeCloudflareHostnamesConfirmed).not.toHaveBeenCalled();
      expect(result.purgeAttemptedHostnames).toEqual([]);
    });
  });
});
