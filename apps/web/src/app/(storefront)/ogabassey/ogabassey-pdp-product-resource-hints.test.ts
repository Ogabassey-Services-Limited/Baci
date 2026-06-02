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

import { OgabasseyPdpProductResourceHints } from './ogabassey-pdp-product-resource-hints';

describe('OgabasseyPdpProductResourceHints', () => {
  beforeEach(() => {
    mockGetImageProps.mockClear();
    mockPreload.mockClear();
  });

  it('emits media-scoped head-only React preload hints for the primary product image', () => {
    const productImage =
      'https://cdn.ogabassey.com/core-assets/products/lenovo-legion.avif';
    const desktopPreloadHref = imageLoader({
      src: productImage,
      width: 750,
      quality: 35,
    });
    const mobilePreloadHref = imageLoader({
      src: productImage,
      width: 750,
      quality: 30,
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

    const mobilePreload = mockPreload.mock.calls.find(
      ([, options]) =>
        (options as Record<string, unknown>).media ===
        OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_MEDIA
    );
    const desktopPreload = mockPreload.mock.calls.find(
      ([, options]) =>
        (options as Record<string, unknown>).media ===
        OGABASSEY_PDP_PRIMARY_IMAGE_DESKTOP_MEDIA
    );

    expect(mobilePreload).toEqual([
      mobilePreloadHref,
      expect.objectContaining({
        as: 'image',
        fetchPriority: 'high',
        imageSizes: OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_SIZES,
        imageSrcSet: expect.stringContaining('quality=30'),
        media: OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_MEDIA,
      }),
    ]);
    expect(
      (mobilePreload?.[1] as { imageSrcSet: string }).imageSrcSet
    ).not.toContain('quality=35');

    expect(desktopPreload).toEqual([
      desktopPreloadHref,
      expect.objectContaining({
        as: 'image',
        fetchPriority: 'high',
        imageSizes: OGABASSEY_PDP_PRIMARY_IMAGE_SIZES,
        imageSrcSet: expect.stringContaining('quality=35'),
        media: OGABASSEY_PDP_PRIMARY_IMAGE_DESKTOP_MEDIA,
      }),
    ]);
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
