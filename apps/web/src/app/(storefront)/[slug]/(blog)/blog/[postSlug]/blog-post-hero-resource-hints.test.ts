import { preconnect, prefetchDNS, preload } from 'react-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { preloadOgabasseyBlogPostHeroResources } from './blog-post-hero-resource-hints';

vi.mock('react-dom', () => ({
  preconnect: vi.fn(),
  prefetchDNS: vi.fn(),
  preload: vi.fn(),
}));

vi.mock('next/image', () => ({
  getImageProps: vi.fn(({ sizes, src }) => ({
    props: {
      sizes,
      srcSet: `${src}?w=640&q=50 640w, ${src}?w=1200&q=50 1200w`,
    },
  })),
}));

const CDN_ORIGIN = 'https://cdn.ogabassey.com';
const CDN_HERO = `${CDN_ORIGIN}/core-assets/blog/post/hero.jpg`;

describe('preloadOgabasseyBlogPostHeroResources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('preconnects the CDN and emits a quality-aligned responsive preload for CDN heroes', () => {
    preloadOgabasseyBlogPostHeroResources(CDN_HERO);

    expect(prefetchDNS).toHaveBeenCalledWith(CDN_ORIGIN);
    expect(preconnect).toHaveBeenCalledWith(CDN_ORIGIN);
    expect(preload).toHaveBeenCalledWith(
      // The rendered hero uses quality 50, so the preload URL must too — else
      // the browser fetches the image twice. PR-IMG-2c flipped the loader
      // default off format=auto, so both the preload and its lockstep <Image>
      // render now emit the decodable jpeg tier (typed image/jpeg).
      'https://cdn.ogabassey.com/image/width=1200,quality=50,format=jpeg/core-assets/blog/post/hero.jpg',
      expect.objectContaining({
        as: 'image',
        fetchPriority: 'high',
        imageSizes:
          '(max-width: 768px) 100vw, (max-width: 1200px) 100vw, 1200px',
        imageSrcSet: expect.stringContaining('1200w'),
        type: 'image/jpeg',
      })
    );
  });

  it('does nothing for non-OgaBassey-CDN heroes', () => {
    preloadOgabasseyBlogPostHeroResources('https://example.com/hero.jpg');

    expect(prefetchDNS).not.toHaveBeenCalled();
    expect(preconnect).not.toHaveBeenCalled();
    expect(preload).not.toHaveBeenCalled();
  });

  it('does nothing for empty or missing sources', () => {
    preloadOgabasseyBlogPostHeroResources('   ');
    preloadOgabasseyBlogPostHeroResources(null);
    preloadOgabasseyBlogPostHeroResources(undefined);

    expect(preload).not.toHaveBeenCalled();
  });
});
