import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cloudflare: vi.fn(),
  products: vi.fn(),
  categories: vi.fn(),
  revalidateTag: vi.fn(),
  vercel: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidateTag: mocks.revalidateTag }));
vi.mock('@/lib/strict-cloudflare-hostname-purge', () => ({
  strictCloudflareHostnamePurge: mocks.cloudflare,
}));
vi.mock('@/lib/product-cache-revalidation', () => ({
  productCacheRevalidation: { revalidateProducts: mocks.products },
}));
vi.mock('@/lib/revalidate-categories', () => ({
  revalidateCategories: mocks.categories,
}));
vi.mock('@/lib/vercel-storefront-publication-cache', () => ({
  purgeVercelStorefrontPublicationCache: mocks.vercel,
}));

import { drainStorefrontCacheInvalidation } from './drain-storefront-cache-invalidation';

const claim = {
  attempts: 1,
  claim_token: '11111111-1111-4111-8111-111111111111',
  generation: 2,
  merchant_id: '22222222-2222-4222-8222-222222222222',
  product_slugs: ['cache-phone', '33333333-3333-4333-8333-333333333333'],
  related_identifiers: ['shop-one', 'shop.example.com'],
  target_id: 'shop-one',
  target_kind: 'storefront_slug' as const,
};

describe('drainStorefrontCacheInvalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_ROOT_DOMAIN', 'usebaci.com');
    mocks.products.mockReturnValue(true);
    mocks.vercel.mockResolvedValue({ ok: true, reason: 'deleted' });
    mocks.cloudflare.mockResolvedValue({ ok: true });
  });

  it('confirms Next then Vercel then Cloudflare in strict order', async () => {
    await expect(drainStorefrontCacheInvalidation(claim)).resolves.toEqual({
      ok: true,
    });

    expect(mocks.revalidateTag).toHaveBeenCalled();
    expect(mocks.revalidateTag.mock.invocationCallOrder.at(-1)).toBeLessThan(
      mocks.vercel.mock.invocationCallOrder[0]
    );
    expect(mocks.vercel.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.cloudflare.mock.invocationCallOrder[0]
    );
    expect(mocks.cloudflare).toHaveBeenCalledWith(['shop-one.usebaci.com']);
    expect(mocks.vercel).toHaveBeenCalledWith(
      expect.arrayContaining([
        'merchant-shop.example.com',
        'product-lcp-image',
        'product-lcp-image-22222222-2222-4222-8222-222222222222-cache-phone',
      ])
    );
  });

  it('times out a delayed Vercel deletion before reaching Cloudflare', async () => {
    mocks.vercel.mockReturnValue(new Promise(() => undefined));

    await expect(
      drainStorefrontCacheInvalidation(claim, { vercelTimeoutMs: 5 })
    ).resolves.toEqual({ errorCode: 'vercel_timeout', ok: false });
    expect(mocks.cloudflare).not.toHaveBeenCalled();
  });

  it('never reaches Cloudflare when Vercel deletion is unconfirmed', async () => {
    mocks.vercel.mockResolvedValue({ ok: false, reason: 'request_failed' });

    await expect(drainStorefrontCacheInvalidation(claim)).resolves.toEqual({
      errorCode: 'vercel_request_failed',
      ok: false,
    });
    expect(mocks.cloudflare).not.toHaveBeenCalled();
  });

  it('propagates bounded Cloudflare throttling without exposing provider data', async () => {
    mocks.cloudflare.mockResolvedValue({
      ok: false,
      errorCode: 'cloudflare_http_429',
      retryAfterSeconds: 120,
    });

    await expect(drainStorefrontCacheInvalidation(claim)).resolves.toEqual({
      errorCode: 'cloudflare_http_429',
      ok: false,
      retryAfterSeconds: 120,
    });
  });
});
