import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OGABASSEY_PDP_PRIMARY_IMAGE_SIZES } from '@/components/storefront/ogabassey/config/product-media';
import { OGABASSEY_CDN_ORIGIN } from '@/components/storefront/ogabassey/config/storefront-origins';

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
const mockPreconnect = vi.hoisted(() => vi.fn());
const mockPrefetchDNS = vi.hoisted(() => vi.fn());

vi.mock('react-dom', () => ({
  preconnect: mockPreconnect,
  prefetchDNS: mockPrefetchDNS,
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
    mockPreconnect.mockClear();
    mockPrefetchDNS.mockClear();
  });

  it('emits a unified head-only React preload hint for the primary product image', () => {
    const productImage =
      'https://cdn.ogabassey.com/core-assets/products/lenovo-legion.avif';
    const desktopPreloadHref =
      'https://cdn.ogabassey.com/image/width=750,quality=35,format=auto/core-assets/products/lenovo-legion.avif';
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
        imageSrcSet: expect.stringContaining(
          'https://cdn.ogabassey.com/image/width=750,quality=35,format=auto/core-assets/products/lenovo-legion.avif 750w'
        ),
      })
    );
    const { options } = getPreloadCall(0);
    expect(options).not.toHaveProperty('media');
    expect(desktopPreloadHref).toBe(
      'https://cdn.ogabassey.com/image/width=750,quality=35,format=auto/core-assets/products/lenovo-legion.avif'
    );
    expect(options.imageSrcSet).toContain('/image/width=');
    expect(options.imageSrcSet).toContain('quality=35');
    expect(options.imageSrcSet).toContain('format=auto');
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
        imageSrcSet: expect.stringContaining(
          'https://cdn.ogabassey.com/image/width=750,quality=35,format=auto/core-assets/products/z-fold-7-jet-black.avif 750w'
        ),
      })
    );
    expect(options.imageSrcSet).toContain(
      'https://cdn.ogabassey.com/image/width=750,quality=35,format=auto/core-assets/products/z-fold-7-jet-black.avif 750w'
    );
    expect(options).not.toHaveProperty('media');
  });

  it('skips legacy same-origin PDP image preload inputs without a direct image source', () => {
    const legacySameOriginProps = {
      imageVersion: 'lcpv1',
      productSlug: 'z-fold-7-jet-black',
      src: null,
    } as unknown as { src: null };
    const html = renderToStaticMarkup(
      createElement(OgabasseyPdpProductResourceHints, legacySameOriginProps)
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

  it('preconnects and prefetches DNS for the CDN origin alongside the hero preload for a CDN-hosted image', () => {
    const productImage =
      'https://cdn.ogabassey.com/core-assets/products/lenovo-legion.avif';

    renderToStaticMarkup(
      createElement(OgabasseyPdpProductResourceHints, { src: productImage })
    );

    expect(mockPrefetchDNS).toHaveBeenCalledTimes(1);
    expect(mockPrefetchDNS).toHaveBeenCalledWith(OGABASSEY_CDN_ORIGIN);
    expect(mockPreconnect).toHaveBeenCalledTimes(1);
    expect(mockPreconnect).toHaveBeenCalledWith(OGABASSEY_CDN_ORIGIN);
    expect(mockPreload).toHaveBeenCalledTimes(1);
  });

  it('does not preconnect to the CDN origin for a non-CDN product image', () => {
    const productImage =
      'https://assets.example.com/products/lenovo-legion.png';

    renderToStaticMarkup(
      createElement(OgabasseyPdpProductResourceHints, { src: productImage })
    );

    expect(mockPrefetchDNS).not.toHaveBeenCalled();
    expect(mockPreconnect).not.toHaveBeenCalled();
    expect(mockPreload).toHaveBeenCalledTimes(1);
  });

  it('does not preconnect to the CDN origin when there is no product image', () => {
    renderToStaticMarkup(
      createElement(OgabasseyPdpProductResourceHints, { src: null })
    );

    expect(mockPrefetchDNS).not.toHaveBeenCalled();
    expect(mockPreconnect).not.toHaveBeenCalled();
  });
});
