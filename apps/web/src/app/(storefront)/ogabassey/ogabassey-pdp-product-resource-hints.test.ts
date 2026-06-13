import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OGABASSEY_PDP_PRIMARY_IMAGE_SIZES } from '@/components/storefront/ogabassey/config/product-media';
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

type PreloadOptions = {
  imageSizes?: string;
  imageSrcSet?: string;
  media?: string;
};

function getPreloadCall(index: number) {
  const call = mockPreload.mock.calls[index];
  expect(call).toBeDefined();

  return {
    href: call?.[0] as string,
    options: call?.[1] as PreloadOptions,
  };
}

describe('OgabasseyPdpProductResourceHints', () => {
  beforeEach(() => {
    mockGetImageProps.mockClear();
    mockPreload.mockClear();
  });

  it('emits a unified head-only React preload hint for the primary product image', () => {
    const productImage =
      'https://cdn.ogabassey.com/core-assets/products/lenovo-legion.avif';
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
    expect(mockPreload).toHaveBeenCalledTimes(1);
    expect(mockPreload).toHaveBeenCalledWith(
      desktopPreloadHref,
      expect.objectContaining({
        as: 'image',
        fetchPriority: 'high',
        imageSizes: OGABASSEY_PDP_PRIMARY_IMAGE_SIZES,
        imageSrcSet: expect.stringContaining('quality=35'),
      })
    );
    const { options } = getPreloadCall(0);
    expect(options).not.toHaveProperty('media');
    expect(options.imageSrcSet).not.toContain('quality=30');
  });

  it('emits exactly one preload per responsive PDP product image profile', () => {
    const productImage =
      'https://cdn.ogabassey.com/core-assets/products/z-fold-7-jet-black.avif';

    renderToStaticMarkup(
      createElement(OgabasseyPdpProductResourceHints, { src: productImage })
    );

    expect(mockPreload).toHaveBeenCalledTimes(1);
    const { options } = getPreloadCall(0);
    expect(options).toEqual(
      expect.objectContaining({
        imageSizes: OGABASSEY_PDP_PRIMARY_IMAGE_SIZES,
        imageSrcSet: expect.stringContaining('quality=35'),
      })
    );
    expect(options).not.toHaveProperty('media');
  });

  it('uses versioned same-origin PDP image URLs when a product slug is provided', () => {
    renderToStaticMarkup(
      createElement(OgabasseyPdpProductResourceHints, {
        imageVersion: 'lcpv1',
        productSlug: 'z-fold-7-jet-black',
        src: null,
      })
    );

    expect(mockGetImageProps).toHaveBeenCalledWith(
      expect.objectContaining({
        loader: expect.any(Function),
        quality: 35,
        sizes: OGABASSEY_PDP_PRIMARY_IMAGE_SIZES,
        src: '/api/ogabassey/pdp-lcp-image/profile/desktop/z-fold-7-jet-black?v=lcpv1',
      })
    );

    expect(mockPreload).toHaveBeenCalledTimes(1);
    const { href, options } = getPreloadCall(0);
    expect(href).toBe(
      '/api/ogabassey/pdp-lcp-image/profile/desktop/z-fold-7-jet-black?v=lcpv1&w=640&q=35'
    );
    expect(href).not.toContain('cdn.ogabassey.com');
    expect(href).not.toContain('/_next/image');
    expect(options.imageSrcSet).toContain(
      '/api/ogabassey/pdp-lcp-image/profile/desktop/z-fold-7-jet-black?v=lcpv1&w=640&q=35 640w'
    );
    expect(options.imageSrcSet).not.toContain('cdn.ogabassey.com');
    expect(options.imageSrcSet).not.toContain('/_next/image');
    expect(options.imageSizes).toBe(OGABASSEY_PDP_PRIMARY_IMAGE_SIZES);
    expect(options).not.toHaveProperty('media');
  });

  it('skips same-origin PDP image preloads without an image version', () => {
    const html = renderToStaticMarkup(
      createElement(OgabasseyPdpProductResourceHints, {
        productSlug: 'z-fold-7-jet-black',
        src: null,
      })
    );

    expect(html).toBe('');
    expect(mockGetImageProps).not.toHaveBeenCalled();
    expect(mockPreload).not.toHaveBeenCalled();
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
