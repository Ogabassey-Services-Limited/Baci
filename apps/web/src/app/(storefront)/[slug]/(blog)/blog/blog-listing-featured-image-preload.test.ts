import { preload } from 'react-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { preloadBlogListingFeaturedImage } from './blog-listing-featured-image-preload';

vi.mock('server-only', () => ({}));

vi.mock('react-dom', () => ({
  preload: vi.fn(),
}));

// Build the srcSet by calling the REAL shared loader the module passes in, so
// the mock produces genuine explicit-format URLs: CDN sources become the jpeg
// fallback tier (`buildOgabasseyAvifSrcSet` can derive the AVIF twin), and
// non-CDN sources delegate to the app's global loader unchanged.
vi.mock('next/image', () => ({
  getImageProps: vi.fn(
    (props: {
      loader: (params: {
        quality?: number;
        src: string;
        width: number;
      }) => string;
      quality?: number;
      sizes?: string;
      src: string;
    }) => {
      const widths = [384, 640, 750, 828, 1080, 1200, 1440];
      return {
        props: {
          sizes: props.sizes,
          srcSet: widths
            .map(
              (width) =>
                `${props.loader({
                  quality: props.quality,
                  src: props.src,
                  width,
                })} ${width}w`
            )
            .join(', '),
        },
      };
    }
  ),
}));

describe('preloadBlogListingFeaturedImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('preloads the AVIF tier the featured-story picture paints for CDN heroes', () => {
    preloadBlogListingFeaturedImage(
      'https://cdn.ogabassey.com/core-assets/blog/post/hero.jpg'
    );

    // Explicit `format=avif` twin at the 750 preload width — never the
    // poisonable `format=auto` body (Cloudflare Free ignores Vary: Accept).
    expect(preload).toHaveBeenCalledWith(
      'https://cdn.ogabassey.com/image/width=750,quality=50,format=avif/core-assets/blog/post/hero.jpg',
      expect.objectContaining({
        as: 'image',
        fetchPriority: 'high',
        imageSizes: '100vw',
        imageSrcSet: expect.stringContaining(
          'https://cdn.ogabassey.com/image/width=750,quality=50,format=avif/core-assets/blog/post/hero.jpg 750w'
        ),
        type: 'image/avif',
      })
    );
    const options = vi.mocked(preload).mock.calls[0]?.[1];
    expect(options?.imageSrcSet).toContain('640w');
    expect(options?.imageSrcSet).toContain('format=avif');
    expect(options?.imageSrcSet).not.toContain('format=auto');
    expect(options?.imageSrcSet).not.toContain('format=jpeg');
  });

  it('preloads the decodable fallback (no AVIF twin) for root-relative blog images', () => {
    preloadBlogListingFeaturedImage('/uploads/blog/hero.jpg');

    expect(preload).toHaveBeenCalledWith(
      '/uploads/blog/hero.jpg?w=750&q=50',
      expect.objectContaining({
        as: 'image',
        fetchPriority: 'high',
        imageSizes: '100vw',
        imageSrcSet: expect.stringContaining('/uploads/blog/hero.jpg?w=640'),
      })
    );
    const options = vi.mocked(preload).mock.calls[0]?.[1];
    expect(options?.imageSrcSet).not.toContain('format=avif');
  });

  it('skips invalid or local fallback image sources', () => {
    preloadBlogListingFeaturedImage('javascript:alert(1)');
    preloadBlogListingFeaturedImage('//cdn.example.com/image.jpg');
    preloadBlogListingFeaturedImage('/placeholder.png');
    preloadBlogListingFeaturedImage(undefined);

    expect(preload).not.toHaveBeenCalled();
  });
});
