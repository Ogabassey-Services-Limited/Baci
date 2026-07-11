import { preload } from 'react-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { preloadBlogListingFeaturedImage } from './blog-listing-featured-image-preload';

vi.mock('react-dom', () => ({
  preload: vi.fn(),
}));

vi.mock('next/image', () => ({
  getImageProps: vi.fn(({ sizes, src }) => ({
    props: {
      sizes,
      srcSet: `${src}?w=640&q=50 640w, ${src}?w=750&q=50 750w`,
    },
  })),
}));

describe('preloadBlogListingFeaturedImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('emits an early high-priority responsive preload for valid blog images', () => {
    preloadBlogListingFeaturedImage(
      'https://cdn.ogabassey.com/core-assets/blog/post/hero.jpg'
    );

    // PR-IMG-2c: the loader default flipped off browser-facing format=auto, so
    // the blog featured-story preload (and its lockstep <Image> render) now emit
    // the universally decodable jpeg tier.
    expect(preload).toHaveBeenCalledWith(
      'https://cdn.ogabassey.com/image/width=750,quality=50,format=jpeg/core-assets/blog/post/hero.jpg',
      expect.objectContaining({
        as: 'image',
        fetchPriority: 'high',
        imageSizes: '100vw',
        imageSrcSet: expect.stringContaining('640w'),
      })
    );
    expect(vi.mocked(preload).mock.calls[0]?.[1]?.imageSrcSet).toContain(
      '750w'
    );
  });

  it('emits an early high-priority responsive preload for root-relative blog images', () => {
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
  });

  it('skips invalid or local fallback image sources', () => {
    preloadBlogListingFeaturedImage('javascript:alert(1)');
    preloadBlogListingFeaturedImage('//cdn.example.com/image.jpg');
    preloadBlogListingFeaturedImage('/placeholder.png');
    preloadBlogListingFeaturedImage(undefined);

    expect(preload).not.toHaveBeenCalled();
  });
});
