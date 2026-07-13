import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetCachedMerchant = vi.hoisted(() => vi.fn());
vi.mock('@/lib/cached-data', () => ({
  getCachedMerchant: (...args: unknown[]) => mockGetCachedMerchant(...args),
}));

const mockLoadLaunchProducts = vi.hoisted(() => vi.fn());
vi.mock('./ogabassey-home-launch-products', () => ({
  loadOgabasseyLaunchProducts: (...args: unknown[]) =>
    mockLoadLaunchProducts(...args),
}));

const mockBuildLaunchSlides = vi.hoisted(() => vi.fn());
vi.mock(
  '@/components/storefront/ogabassey/components/build-launch-slides',
  () => ({
    buildLaunchSlides: (...args: unknown[]) => mockBuildLaunchSlides(...args),
  })
);

vi.mock('next/navigation', () => ({
  unstable_rethrow: vi.fn(),
}));

import { unstable_rethrow } from 'next/navigation';
import { resolveOgabasseyHomeHeroShell } from './ogabassey-home-hero-shell-data';

const SLIDE = {
  kind: 'product',
  id: 'p1',
  name: 'Tecno Spark 40 Pro',
  priceLabel: '₦250,000',
  href: '/smartphones/tecno-spark-40-pro',
  imageUrl: 'https://cdn.ogabassey.com/core-assets/products/tecno.avif',
  imageAlt: 'Tecno Spark 40 Pro',
  ctaLabel: 'Shop now',
};

describe('resolveOgabasseyHomeHeroShell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCachedMerchant.mockResolvedValue({
      custom_domain: 'ogabassey.com',
      id: 'merchant-1',
      is_published: true,
      slug: 'ogabassey',
    });
    mockLoadLaunchProducts.mockResolvedValue([{ id: 'p1' }]);
    mockBuildLaunchSlides.mockReturnValue([SLIDE]);
  });

  it('builds origin-independent canonical links for every OgaBassey alias', async () => {
    const shell = await resolveOgabasseyHomeHeroShell();

    expect(mockGetCachedMerchant).toHaveBeenCalledWith('ogabassey');
    // Hero prices format in the merchant's resolved currency (NGN for the
    // ogabassey merchant), keeping them consistent with the grid feed.
    expect(mockLoadLaunchProducts).toHaveBeenCalledWith(
      'merchant-1',
      expect.objectContaining({ code: 'NGN' })
    );
    expect(mockBuildLaunchSlides).toHaveBeenCalledWith(
      [{ id: 'p1' }],
      'https://ogabassey.com'
    );
    expect(shell).toEqual({ status: 'published', slides: [SLIDE] });
  });

  it('returns null when the merchant is missing', async () => {
    mockGetCachedMerchant.mockResolvedValue(null);

    await expect(resolveOgabasseyHomeHeroShell()).resolves.toBeNull();
    expect(mockLoadLaunchProducts).not.toHaveBeenCalled();
  });

  it('returns an unpublished result when publication status is null', async () => {
    mockGetCachedMerchant.mockResolvedValue({
      id: 'merchant-1',
      is_published: null,
    });

    await expect(resolveOgabasseyHomeHeroShell()).resolves.toEqual({
      status: 'unpublished',
    });
    expect(mockLoadLaunchProducts).not.toHaveBeenCalled();
  });

  it('returns an unpublished result when the merchant is unpublished', async () => {
    mockGetCachedMerchant.mockResolvedValue({
      id: 'merchant-1',
      is_published: false,
    });

    await expect(resolveOgabasseyHomeHeroShell()).resolves.toEqual({
      status: 'unpublished',
    });
    expect(mockLoadLaunchProducts).not.toHaveBeenCalled();
  });

  it('keeps a published empty state when no launch slides can be built', async () => {
    mockBuildLaunchSlides.mockReturnValue([]);

    await expect(resolveOgabasseyHomeHeroShell()).resolves.toEqual({
      status: 'published',
      slides: [],
    });
  });

  it('fails open to null when a cached lookup throws (shell must not break)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockGetCachedMerchant.mockRejectedValue(new Error('cache backend down'));

    await expect(resolveOgabasseyHomeHeroShell()).resolves.toBeNull();
  });

  it('rethrows a Next-internal error instead of swallowing it (unstable_rethrow contract)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const nextInternalError = new Error('NEXT_HTTP_ERROR_FALLBACK;404');
    mockGetCachedMerchant.mockRejectedValue(nextInternalError);
    vi.mocked(unstable_rethrow).mockImplementationOnce((error: unknown) => {
      throw error;
    });

    await expect(resolveOgabasseyHomeHeroShell()).rejects.toThrow(
      nextInternalError
    );
  });

  it('resolves to null once the cached lookup exceeds the SHELL_LOOKUP_BUDGET_MS budget', async () => {
    vi.useFakeTimers();
    try {
      // Never resolves within the test — the budget race must win instead.
      mockGetCachedMerchant.mockReturnValue(
        new Promise<never>(() => {
          // Intentionally left pending: exercises the SHELL_LOOKUP_BUDGET_MS
          // timeout race rather than a resolved/rejected merchant lookup.
        })
      );

      const shellPromise = resolveOgabasseyHomeHeroShell();
      await vi.advanceTimersByTimeAsync(500);

      await expect(shellPromise).resolves.toBeNull();
      expect(mockBuildLaunchSlides).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
