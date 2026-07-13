import { beforeEach, describe, expect, it, vi } from 'vitest';

const callOrder: string[] = [];
const mockRevalidateMerchantPublication = vi.fn();
const mockBuildDataCacheTags = vi.fn();
const mockBuildCacheTags = vi.fn();
const mockBuildPurgeHostnames = vi.fn();
const mockPurgeVercel = vi.fn();
const mockPurgeCloudflare = vi.fn();

vi.mock('@/lib/cache-revalidation', () => ({
  revalidateMerchantPublication: (...args: unknown[]) =>
    mockRevalidateMerchantPublication(...args),
}));
vi.mock('@/lib/merchant-publication-data-cache-tags', () => ({
  buildMerchantPublicationDataCacheTags: (...args: unknown[]) =>
    mockBuildDataCacheTags(...args),
}));
vi.mock('@/lib/storefront-publication-cache-tags', () => ({
  buildStorefrontPublicationCacheTags: (...args: unknown[]) =>
    mockBuildCacheTags(...args),
}));
vi.mock('@/lib/storefront-publication-purge-hostnames', () => ({
  buildStorefrontPublicationPurgeHostnames: (...args: unknown[]) =>
    mockBuildPurgeHostnames(...args),
}));
vi.mock('@/lib/vercel-storefront-publication-cache', () => ({
  purgeVercelStorefrontPublicationCache: (...args: unknown[]) =>
    mockPurgeVercel(...args),
}));
vi.mock('@/lib/cloudflare-purge', () => ({
  purgeCloudflareHostnamesConfirmed: (...args: unknown[]) =>
    mockPurgeCloudflare(...args),
}));

import { evictStorefrontPublicationCaches } from './storefront-publication-cache-eviction';

const IDENTITY = {
  canonicalMerchantSlug: 'current-store',
  customDomains: ['shop.example.com', 'secondary.example.com'],
  identifiers: [
    'current-store',
    'old-store',
    'shop.example.com',
    'secondary.example.com',
  ],
  merchantId: 'merchant-1',
  merchantSlugs: ['current-store', 'old-store'],
} as const;

describe('evictStorefrontPublicationCaches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    callOrder.length = 0;
    mockRevalidateMerchantPublication.mockImplementation(() => {
      callOrder.push('next');
    });
    mockBuildDataCacheTags.mockReturnValue([
      'merchant-id-merchant-1',
      'merchant-slug-current-store',
      'merchant-slug-old-store',
    ]);
    mockBuildCacheTags.mockReturnValue(['ps:current-store', 'ps:old-store']);
    mockBuildPurgeHostnames.mockReturnValue(['shop.example.com']);
    mockPurgeVercel.mockImplementation(() => {
      callOrder.push('vercel');
      return Promise.resolve({ ok: true, reason: 'deleted' });
    });
    mockPurgeCloudflare.mockImplementation(() => {
      callOrder.push('cloudflare');
      return Promise.resolve({ ok: true, reason: 'purged' });
    });
  });

  it('awaits the combined Data/CDN deletion before purging Cloudflare', async () => {
    let releaseVercel: (() => void) | undefined;
    const vercelGate = new Promise<void>((resolve) => {
      releaseVercel = resolve;
    });
    mockPurgeVercel.mockImplementation(async () => {
      callOrder.push('vercel-start');
      await vercelGate;
      callOrder.push('vercel-complete');
      return { ok: true, reason: 'deleted' };
    });

    const pendingEviction = evictStorefrontPublicationCaches(IDENTITY);
    await vi.waitFor(() => {
      expect(mockPurgeVercel).toHaveBeenCalledOnce();
    });
    expect(callOrder).toEqual(['next', 'vercel-start']);
    expect(mockPurgeCloudflare).not.toHaveBeenCalled();

    releaseVercel?.();
    await expect(pendingEviction).resolves.toEqual({ ok: true });

    expect(callOrder).toEqual([
      'next',
      'vercel-start',
      'vercel-complete',
      'cloudflare',
    ]);
    expect(mockRevalidateMerchantPublication).toHaveBeenCalledWith({
      canonicalMerchantSlug: 'current-store',
      identifiers: IDENTITY.identifiers,
      merchantId: 'merchant-1',
    });
    expect(mockBuildDataCacheTags).toHaveBeenCalledWith({
      canonicalMerchantSlug: 'current-store',
      identifiers: IDENTITY.identifiers,
      merchantId: 'merchant-1',
    });
    expect(mockBuildCacheTags).toHaveBeenCalledWith({
      customDomains: IDENTITY.customDomains,
      merchantSlugs: IDENTITY.merchantSlugs,
    });
    expect(mockBuildPurgeHostnames).toHaveBeenCalledWith(IDENTITY.identifiers);
    expect(mockPurgeVercel).toHaveBeenCalledWith([
      'merchant-id-merchant-1',
      'merchant-slug-current-store',
      'merchant-slug-old-store',
      'ps:current-store',
      'ps:old-store',
    ]);
    expect(mockPurgeCloudflare).toHaveBeenCalledWith(['shop.example.com']);
  });

  it('stops before outer eviction when Next cannot queue revalidation', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockRevalidateMerchantPublication.mockImplementation(() => {
      throw new Error('next cache unavailable');
    });

    await expect(evictStorefrontPublicationCaches(IDENTITY)).resolves.toEqual({
      ok: false,
      reason: 'request_failed',
      stage: 'next',
    });
    expect(mockPurgeVercel).not.toHaveBeenCalled();
    expect(mockPurgeCloudflare).not.toHaveBeenCalled();
  });

  it('continues to Cloudflare when the Vercel barrier is not applicable', async () => {
    mockPurgeVercel.mockResolvedValue({
      ok: true,
      reason: 'not_running_on_vercel',
    });

    await expect(evictStorefrontPublicationCaches(IDENTITY)).resolves.toEqual({
      ok: true,
    });
    expect(mockPurgeCloudflare).toHaveBeenCalledWith(['shop.example.com']);
  });

  it('does not purge Cloudflare when Vercel deletion is unconfirmed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockPurgeVercel.mockImplementation(() => {
      callOrder.push('vercel');
      return Promise.resolve({ ok: false, reason: 'request_failed' });
    });

    await expect(evictStorefrontPublicationCaches(IDENTITY)).resolves.toEqual({
      ok: false,
      reason: 'request_failed',
      stage: 'vercel',
    });
    expect(callOrder).toEqual(['next', 'vercel']);
    expect(mockPurgeCloudflare).not.toHaveBeenCalled();
  });

  it('reports an unconfirmed Cloudflare purge after Vercel succeeds', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockPurgeCloudflare.mockImplementation(() => {
      callOrder.push('cloudflare');
      return Promise.resolve({ ok: false, reason: 'provider_rejected' });
    });

    await expect(evictStorefrontPublicationCaches(IDENTITY)).resolves.toEqual({
      ok: false,
      reason: 'provider_rejected',
      stage: 'cloudflare',
    });
    expect(callOrder).toEqual(['next', 'vercel', 'cloudflare']);
  });
});
