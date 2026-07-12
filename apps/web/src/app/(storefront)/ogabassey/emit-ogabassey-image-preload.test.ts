import { preload } from 'react-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emitOgabasseyImagePreload } from './emit-ogabassey-image-preload';

vi.mock('server-only', () => ({}));

vi.mock('react-dom', () => ({
  preload: vi.fn(),
}));

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
    }) => ({
      props: {
        sizes: props.sizes,
        srcSet: [384, 750, 1200]
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
    })
  ),
}));

describe('emitOgabasseyImagePreload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('emits the AVIF tier with responsive candidate parity for CDN images', () => {
    emitOgabasseyImagePreload({
      preloadWidth: 1200,
      quality: 50,
      sizes: '100vw',
      src: 'https://cdn.ogabassey.com/core-assets/blog/post/hero.jpg',
    });

    expect(preload).toHaveBeenCalledWith(
      'https://cdn.ogabassey.com/image/width=1200,quality=50,format=avif/core-assets/blog/post/hero.jpg',
      expect.objectContaining({
        as: 'image',
        fetchPriority: 'high',
        imageSizes: '100vw',
        imageSrcSet: expect.stringContaining('format=avif'),
        type: 'image/avif',
      })
    );
  });

  it('emits the decodable fallback when no AVIF transform twin exists', () => {
    emitOgabasseyImagePreload({
      preloadWidth: 750,
      quality: 50,
      sizes: '100vw',
      src: '/uploads/blog/hero.jpg',
    });

    expect(preload).toHaveBeenCalledWith(
      '/uploads/blog/hero.jpg?w=750&q=50',
      expect.objectContaining({
        imageSizes: '100vw',
        imageSrcSet: expect.stringContaining('/uploads/blog/hero.jpg?w=384'),
      })
    );
  });
});
