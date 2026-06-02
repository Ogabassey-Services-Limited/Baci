import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  OGABASSEY_PDP_PRIMARY_IMAGE_DESKTOP_MEDIA,
  OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_MEDIA,
  OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_SIZES,
  OGABASSEY_PDP_PRIMARY_IMAGE_SIZES,
} from '@/components/storefront/ogabassey/config/product-media';
import imageLoader from '@/lib/image-loader';

vi.mock('server-only', () => ({}));

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

vi.mock('next/image', () => ({
  getImageProps: mockGetImageProps,
}));

const mockPreload = vi.hoisted(() => vi.fn());

vi.mock('react-dom', () => ({
  preload: mockPreload,
}));

import {
  OgabasseyPdpProductResourceHints,
  preloadOgabasseyPdpProductResources,
} from './ogabassey-pdp-product-resource-hints';

describe('OgabasseyPdpProductResourceHints', () => {
  beforeEach(() => {
    mockGetImageProps.mockClear();
    mockPreload.mockClear();
  });

  it('emits head-only React preload hints for the primary product image with the gallery sizes', () => {
    const productImage =
      'https://cdn.ogabassey.com/core-assets/products/lenovo-legion.avif';
    const mobilePreloadHref = imageLoader({
      src: productImage,
      width: 750,
      quality: 30,
    });
    const desktopPreloadHref = imageLoader({
      src: productImage,
      width: 750,
      quality: 35,
    });

    const html = renderToStaticMarkup(
      createElement(OgabasseyPdpProductResourceHints, { src: productImage })
    );

    expect(mockGetImageProps).toHaveBeenCalledWith(
      expect.objectContaining({
        loader: expect.any(Function),
        quality: 35,
        sizes: OGABASSEY_PDP_PRIMARY_IMAGE_SIZES,
        src: productImage,
      })
    );
    expect(html).toBe('');
    expect(mockPreload).toHaveBeenCalledTimes(2);
    expect(mockPreload).toHaveBeenCalledWith(
      mobilePreloadHref,
      expect.objectContaining({
        as: 'image',
        fetchPriority: 'high',
        imageSizes: OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_SIZES,
        media: OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_MEDIA,
        imageSrcSet: expect.stringContaining('750w'),
      })
    );
    expect(mockPreload).toHaveBeenCalledWith(
      desktopPreloadHref,
      expect.objectContaining({
        as: 'image',
        fetchPriority: 'high',
        imageSizes: OGABASSEY_PDP_PRIMARY_IMAGE_SIZES,
        imageSrcSet: expect.stringContaining('lenovo-legion.avif'),
        media: OGABASSEY_PDP_PRIMARY_IMAGE_DESKTOP_MEDIA,
      })
    );
    expect(mockPreload.mock.calls[0]?.[1]).toHaveProperty(
      'media',
      OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_MEDIA
    );
    expect(mockPreload.mock.calls[1]?.[1]).toHaveProperty(
      'media',
      OGABASSEY_PDP_PRIMARY_IMAGE_DESKTOP_MEDIA
    );
  });

  it('uses the fallback URL extension when the image is not CDN transformed', () => {
    const productImage =
      'https://assets.example.com/products/lenovo-legion.png';

    const html = renderToStaticMarkup(
      createElement(OgabasseyPdpProductResourceHints, { src: productImage })
    );

    expect(html).toBe('');
    expect(mockPreload).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ type: 'image/png' })
    );
  });

  it('keeps transformed CDN mobile and desktop preloads distinct by image source metadata', () => {
    const transformedProductImage =
      'https://cdn.ogabassey.com/image/width=750,quality=35,format=auto/core-assets/products/lenovo-legion.avif';

    preloadOgabasseyPdpProductResources({ src: transformedProductImage });

    expect(mockPreload).toHaveBeenCalledTimes(2);

    const [mobileHref, mobileOptions] = mockPreload.mock.calls[0] ?? [];
    const [desktopHref, desktopOptions] = mockPreload.mock.calls[1] ?? [];

    expect(mobileHref).toBe(transformedProductImage);
    expect(desktopHref).toBe(transformedProductImage);
    expect(mobileOptions).toEqual(
      expect.objectContaining({
        imageSizes: OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_SIZES,
        imageSrcSet: expect.stringContaining('256w'),
        media: OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_MEDIA,
      })
    );
    expect(desktopOptions).toEqual(
      expect.objectContaining({
        imageSizes: OGABASSEY_PDP_PRIMARY_IMAGE_SIZES,
        imageSrcSet: expect.stringContaining('1920w'),
        media: OGABASSEY_PDP_PRIMARY_IMAGE_DESKTOP_MEDIA,
      })
    );
    expect(mobileOptions).not.toEqual(
      expect.objectContaining({
        imageSizes: desktopOptions?.imageSizes,
        imageSrcSet: desktopOptions?.imageSrcSet,
      })
    );
  });

  it('skips empty product image URLs', () => {
    const html = renderToStaticMarkup(
      createElement(OgabasseyPdpProductResourceHints, { src: '' })
    );

    expect(html).toBe('');
    expect(mockGetImageProps).not.toHaveBeenCalled();
    expect(mockPreload).not.toHaveBeenCalled();
  });

  it('skips null product image URLs', () => {
    const html = renderToStaticMarkup(
      createElement(OgabasseyPdpProductResourceHints, { src: null })
    );

    expect(html).toBe('');
    expect(mockGetImageProps).not.toHaveBeenCalled();
    expect(mockPreload).not.toHaveBeenCalled();
  });

  it('skips undefined product image URLs', () => {
    const html = renderToStaticMarkup(
      createElement(OgabasseyPdpProductResourceHints, { src: undefined })
    );

    expect(html).toBe('');
    expect(mockGetImageProps).not.toHaveBeenCalled();
    expect(mockPreload).not.toHaveBeenCalled();
  });
});
