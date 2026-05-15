import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OGABASSEY_PDP_PRIMARY_IMAGE_SIZES } from '@/components/storefront/ogabassey/config/product-media';
import imageLoader from '@/lib/image-loader';

vi.mock('server-only', () => ({}));

const mockPreload = vi.hoisted(() => vi.fn());
const mockGetImageProps = vi.hoisted(() =>
  vi.fn(
    (props: {
      loader: (params: {
        src: string;
        width: number;
        quality?: number;
      }) => string;
      quality?: number;
      sizes?: string;
      src: string;
    }) => {
      const widths = [256, 384, 640, 750, 828, 1080, 1200, 1920];
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
  )
);

vi.mock('react-dom', () => ({
  preload: mockPreload,
}));

vi.mock('next/image', () => ({
  getImageProps: mockGetImageProps,
}));

import { preloadOgabasseyPdpProductImage } from './ogabassey-pdp-product-resource-hints';

describe('preloadOgabasseyPdpProductImage', () => {
  beforeEach(() => {
    mockGetImageProps.mockClear();
    mockPreload.mockClear();
  });

  it('preloads the primary product image with the same responsive sizes as the gallery', () => {
    const productImage =
      'https://cdn.ogabassey.com/core-assets/products/lenovo-legion.avif';

    preloadOgabasseyPdpProductImage(productImage);

    expect(mockGetImageProps).toHaveBeenCalledWith(
      expect.objectContaining({
        loader: expect.any(Function),
        quality: 70,
        sizes: OGABASSEY_PDP_PRIMARY_IMAGE_SIZES,
        src: productImage,
      })
    );
    expect(mockPreload).toHaveBeenCalledWith(
      imageLoader({ src: productImage, width: 640, quality: 70 }),
      expect.objectContaining({
        as: 'image',
        fetchPriority: 'high',
        imageSizes: OGABASSEY_PDP_PRIMARY_IMAGE_SIZES,
        imageSrcSet: expect.stringContaining(
          imageLoader({ src: productImage, width: 640, quality: 70 })
        ),
        type: 'image/webp',
      })
    );
  });

  it('uses the fallback URL extension when the image is not CDN transformed', () => {
    const productImage =
      'https://assets.example.com/products/lenovo-legion.png';

    preloadOgabasseyPdpProductImage(productImage);

    expect(mockPreload).toHaveBeenCalledWith(
      imageLoader({ src: productImage, width: 640, quality: 70 }),
      expect.objectContaining({
        type: 'image/png',
      })
    );
  });

  it('skips empty product image URLs', () => {
    preloadOgabasseyPdpProductImage('');

    expect(mockPreload).not.toHaveBeenCalled();
  });
});
