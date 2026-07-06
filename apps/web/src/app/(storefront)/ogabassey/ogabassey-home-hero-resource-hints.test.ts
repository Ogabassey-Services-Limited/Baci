import { preconnect, prefetchDNS, preload } from 'react-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { preloadOgabasseyHomeHeroResources } from './ogabassey-home-hero-resource-hints';

vi.mock('react-dom', () => ({
  preconnect: vi.fn(),
  prefetchDNS: vi.fn(),
  preload: vi.fn(),
}));

vi.mock('next/image', () => ({
  getImageProps: vi.fn(({ sizes, src }) => ({
    props: {
      sizes,
      srcSet: `${src}?w=750&q=70 750w, ${src}?w=1440&q=70 1440w`,
    },
  })),
}));

const CDN_ORIGIN = 'https://cdn.ogabassey.com';
const CDN_HERO = `${CDN_ORIGIN}/core-assets/products/tecno-spark-40-pro.avif`;

describe('preloadOgabasseyHomeHeroResources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('preconnects the CDN and emits a mobile-scoped responsive preload for the slide-0 hero', () => {
    preloadOgabasseyHomeHeroResources(CDN_HERO);

    expect(prefetchDNS).toHaveBeenCalledWith(CDN_ORIGIN);
    expect(preconnect).toHaveBeenCalledWith(CDN_ORIGIN);
    expect(preload).toHaveBeenCalledTimes(1);
    const [, options] = vi.mocked(preload).mock.calls[0];
    if (!options) {
      throw new Error('preload was called without options');
    }
    expect(options).toMatchObject({
      as: 'image',
      fetchPriority: 'high',
      // Mobile-only: the field LCP problem is the mobile hero; desktop's
      // grid streams its own images.
      media: '(max-width: 767px)',
    });
    expect(options.imageSrcSet).toContain('750w');
    expect(options.imageSizes).toContain('100vw');
  });

  it('emits nothing for non-CDN sources (loader would not transform them)', () => {
    preloadOgabasseyHomeHeroResources('https://example.com/hero.jpg');

    expect(preload).not.toHaveBeenCalled();
    expect(preconnect).not.toHaveBeenCalled();
  });

  it('emits nothing for blank or missing sources', () => {
    preloadOgabasseyHomeHeroResources('   ');
    preloadOgabasseyHomeHeroResources(null);
    preloadOgabasseyHomeHeroResources(undefined);

    expect(preload).not.toHaveBeenCalled();
  });
});
