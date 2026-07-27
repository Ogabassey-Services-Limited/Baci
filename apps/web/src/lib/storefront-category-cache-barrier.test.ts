import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  buildHostnames: vi.fn<(...args: unknown[]) => string[]>(() => [
    'ogabassey.com',
    'www.ogabassey.com',
  ]),
  purgeCloudflare: vi.fn<
    (...args: unknown[]) => Promise<{ ok: boolean; reason: string }>
  >(async () => ({ ok: true, reason: 'purged' })),
  purgeVercel: vi.fn<
    (...args: unknown[]) => Promise<{ ok: boolean; reason: string }>
  >(async () => ({ ok: true, reason: 'deleted' })),
  revalidateCategories: vi.fn<(...args: unknown[]) => void>(),
  revalidateProducts: vi.fn<(...args: unknown[]) => boolean>(() => true),
}));

vi.mock('@/lib/revalidate-categories', () => ({
  revalidateCategories: mocks.revalidateCategories,
}));
vi.mock('@/lib/product-cache-revalidation', () => ({
  productCacheRevalidation: {
    revalidateProducts: mocks.revalidateProducts,
  },
}));
vi.mock('@/lib/storefront-publication-purge-hostnames', () => ({
  buildStorefrontPublicationPurgeHostnames: mocks.buildHostnames,
}));
vi.mock('@/lib/vercel-storefront-publication-cache', () => ({
  purgeVercelStorefrontPublicationCache: mocks.purgeVercel,
}));
vi.mock('@/lib/cloudflare-purge', () => ({
  purgeCloudflareHostnamesConfirmed: mocks.purgeCloudflare,
}));

import { runStorefrontCategoryCacheBarrier } from './storefront-category-cache-barrier';

const merchantId = '11111111-1111-4111-8111-111111111111';

describe('runStorefrontCategoryCacheBarrier', () => {
  beforeEach(() => {
    mocks.revalidateCategories.mockReset();
    mocks.revalidateProducts.mockReset().mockReturnValue(true);
    mocks.buildHostnames
      .mockReset()
      .mockReturnValue(['ogabassey.com', 'www.ogabassey.com']);
    mocks.purgeVercel
      .mockReset()
      .mockResolvedValue({ ok: true, reason: 'deleted' });
    mocks.purgeCloudflare
      .mockReset()
      .mockResolvedValue({ ok: true, reason: 'purged' });
  });

  it('hard-expires category and product caches before Vercel then Cloudflare', async () => {
    const calls: string[] = [];
    mocks.revalidateCategories.mockImplementation(() => calls.push('next'));
    mocks.purgeVercel.mockImplementation(async () => {
      calls.push('vercel');
      return { ok: true, reason: 'deleted' };
    });
    mocks.purgeCloudflare.mockImplementation(async () => {
      calls.push('cloudflare');
      return { ok: true, reason: 'purged' };
    });

    await expect(
      runStorefrontCategoryCacheBarrier({
        canaryMerchantId: merchantId,
        merchantId,
        nextSlug: 'smartphones',
        previousSlug: 'phones',
        relatedSlugs: ['audio'],
      })
    ).resolves.toEqual({ ok: true });

    expect(mocks.revalidateCategories).toHaveBeenCalledWith(
      merchantId,
      'phones',
      {
        expireImmediately: true,
      }
    );
    expect(mocks.revalidateCategories).toHaveBeenCalledWith(
      merchantId,
      'smartphones',
      {
        expireImmediately: true,
      }
    );
    expect(mocks.revalidateProducts).toHaveBeenCalledWith(
      merchantId,
      undefined,
      {
        expireImmediately: true,
        feedScope: 'merchant',
      }
    );
    expect(calls).toEqual(['next', 'next', 'next', 'vercel', 'cloudflare']);
    expect(mocks.purgeCloudflare).toHaveBeenCalledWith([
      'ogabassey.com',
      'www.ogabassey.com',
    ]);
  });

  it('fails closed for a non-canary merchant, non-Vercel runtime, bad hosts, or failed product revalidation', async () => {
    await expect(
      runStorefrontCategoryCacheBarrier({
        canaryMerchantId: '33333333-3333-4333-8333-333333333333',
        merchantId,
        nextSlug: 'smartphones',
        previousSlug: null,
        relatedSlugs: [],
      })
    ).resolves.toEqual({ ok: false, reason: 'merchant_not_canary' });

    mocks.purgeVercel.mockResolvedValue({
      ok: true,
      reason: 'not_running_on_vercel',
    });
    await expect(
      runStorefrontCategoryCacheBarrier({
        canaryMerchantId: merchantId,
        merchantId,
        nextSlug: 'smartphones',
        previousSlug: null,
        relatedSlugs: [],
      })
    ).resolves.toEqual({ ok: false, reason: 'not_running_on_vercel' });

    mocks.purgeVercel.mockResolvedValue({ ok: true, reason: 'deleted' });
    mocks.buildHostnames.mockReturnValue(['ogabassey.com']);
    await expect(
      runStorefrontCategoryCacheBarrier({
        canaryMerchantId: merchantId,
        merchantId,
        nextSlug: 'smartphones',
        previousSlug: null,
        relatedSlugs: [],
      })
    ).resolves.toEqual({ ok: false, reason: 'unexpected_hostnames' });

    mocks.buildHostnames.mockReturnValue([
      'ogabassey.com',
      'www.ogabassey.com',
    ]);
    mocks.revalidateProducts.mockReturnValue(false);
    await expect(
      runStorefrontCategoryCacheBarrier({
        canaryMerchantId: merchantId,
        merchantId,
        nextSlug: 'smartphones',
        previousSlug: null,
        relatedSlugs: [],
      })
    ).resolves.toEqual({ ok: false, reason: 'product_revalidation_failed' });
  });

  it('fails closed when either external provider rejects or throws', async () => {
    const input = {
      canaryMerchantId: merchantId,
      merchantId,
      nextSlug: 'smartphones',
      previousSlug: null,
      relatedSlugs: [],
    };

    mocks.purgeVercel.mockResolvedValue({
      ok: false,
      reason: 'request_failed',
    });
    await expect(runStorefrontCategoryCacheBarrier(input)).resolves.toEqual({
      ok: false,
      reason: 'vercel_purge_failed',
    });

    mocks.purgeVercel.mockRejectedValue(new Error('Vercel unavailable'));
    await expect(runStorefrontCategoryCacheBarrier(input)).resolves.toEqual({
      ok: false,
      reason: 'vercel_purge_failed',
    });

    mocks.purgeVercel.mockResolvedValue({ ok: true, reason: 'deleted' });
    mocks.purgeCloudflare.mockResolvedValue({
      ok: false,
      reason: 'provider_rejected',
    });
    await expect(runStorefrontCategoryCacheBarrier(input)).resolves.toEqual({
      ok: false,
      reason: 'cloudflare_purge_failed',
    });

    mocks.purgeCloudflare.mockRejectedValue(
      new Error('Cloudflare unavailable')
    );
    await expect(runStorefrontCategoryCacheBarrier(input)).resolves.toEqual({
      ok: false,
      reason: 'cloudflare_purge_failed',
    });
  });
});
