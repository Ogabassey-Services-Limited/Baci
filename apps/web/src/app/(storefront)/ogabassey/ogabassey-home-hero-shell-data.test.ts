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
      id: 'merchant-1',
      is_published: true,
    });
    mockLoadLaunchProducts.mockResolvedValue([{ id: 'p1' }]);
    mockBuildLaunchSlides.mockReturnValue([SLIDE]);
  });

  it('returns cached launch slides for the published ogabassey merchant', async () => {
    const shell = await resolveOgabasseyHomeHeroShell('/ogabassey');

    expect(mockGetCachedMerchant).toHaveBeenCalledWith('ogabassey');
    expect(mockLoadLaunchProducts).toHaveBeenCalledWith('merchant-1');
    expect(mockBuildLaunchSlides).toHaveBeenCalledWith(
      [{ id: 'p1' }],
      '/ogabassey'
    );
    expect(shell).toEqual({ slides: [SLIDE] });
  });

  it('returns null when the merchant is missing', async () => {
    mockGetCachedMerchant.mockResolvedValue(null);

    await expect(resolveOgabasseyHomeHeroShell('')).resolves.toBeNull();
    expect(mockLoadLaunchProducts).not.toHaveBeenCalled();
  });

  it('returns null when the merchant is unpublished', async () => {
    mockGetCachedMerchant.mockResolvedValue({
      id: 'merchant-1',
      is_published: false,
    });

    await expect(resolveOgabasseyHomeHeroShell('')).resolves.toBeNull();
    expect(mockLoadLaunchProducts).not.toHaveBeenCalled();
  });

  it('returns null when no slides can be built (empty launch feed)', async () => {
    mockBuildLaunchSlides.mockReturnValue([]);

    await expect(resolveOgabasseyHomeHeroShell('')).resolves.toBeNull();
  });

  it('fails open to null when a cached lookup throws (shell must not break)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockGetCachedMerchant.mockRejectedValue(new Error('cache backend down'));

    await expect(resolveOgabasseyHomeHeroShell('')).resolves.toBeNull();
  });
});
