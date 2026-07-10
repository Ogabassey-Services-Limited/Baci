import { getImageProps } from 'next/image';
import { preconnect, prefetchDNS, preload } from 'react-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { preloadOgabasseyHomeHeroResources } from './ogabassey-home-hero-resource-hints';

vi.mock('react-dom', () => ({
  preconnect: vi.fn(),
  prefetchDNS: vi.fn(),
  preload: vi.fn(),
}));

// Mirror what the real loader emits (an explicit-format `/image/…` transform
// URL) so the AVIF-rewrite branch is exercised, not a raw `?w=` shape that has
// no AVIF twin.
vi.mock('next/image', () => ({
  getImageProps: vi.fn(
    ({
      sizes,
      src,
      loader,
      quality,
    }: {
      sizes?: string;
      src: string;
      loader?: (input: {
        src: string;
        width: number;
        quality?: number;
      }) => string;
      quality?: number;
    }) => {
      const candidate = (width: number) =>
        loader ? loader({ src, width, quality }) : `${src}?w=${width}`;
      return {
        props: {
          sizes,
          srcSet: `${candidate(750)} 750w, ${candidate(1440)} 1440w`,
        },
      };
    }
  ),
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
    const [href, options] = vi.mocked(preload).mock.calls[0];
    if (!options) {
      throw new Error('preload was called without options');
    }
    expect(options).toMatchObject({
      as: 'image',
      fetchPriority: 'high',
      // Mobile-only: the field LCP problem is the mobile hero; desktop's
      // grid streams its own images.
      media: '(max-width: 767px)',
      // Preload the AVIF tier the picture renders for the ~93% AVIF-capable
      // majority — CF Free ignores Vary, so per-format URLs are the only way
      // the hint matches what the browser paints (one deduped fetch).
      type: 'image/avif',
    });
    expect(String(href)).toContain('format=avif');
    expect(options.imageSrcSet).toContain('format=avif');
    expect(options.imageSrcSet).toContain('750w');
    expect(options.imageSrcSet).not.toContain('format=auto');
    expect(options.imageSizes).toContain('40vw');
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

  it('fails open and swallows the error when getImageProps throws (must never break the shell render)', () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    vi.mocked(getImageProps).mockImplementationOnce(() => {
      throw new Error('getImageProps boom');
    });

    expect(() => preloadOgabasseyHomeHeroResources(CDN_HERO)).not.toThrow();

    // prefetchDNS/preconnect run BEFORE getImageProps and may still fire —
    // what matters is that the throw itself never escapes and preload (which
    // depends on getImageProps' output) never runs with bad data.
    expect(preload).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to emit home hero preload hints',
      expect.objectContaining({ error: expect.any(Error) })
    );

    consoleErrorSpy.mockRestore();
  });
});
