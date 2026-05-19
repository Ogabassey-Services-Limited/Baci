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
const mockPreload = vi.hoisted(() => vi.fn());

vi.mock('next/image', () => ({
  getImageProps: mockGetImageProps,
}));

vi.mock('react-dom', async () => {
  const actual = await vi.importActual<typeof import('react-dom')>('react-dom');
  return {
    ...actual,
    preload: mockPreload,
  };
});

import {
  OgabasseyPdpProductResourceHints,
  preloadOgabasseyPdpProductImage,
} from './ogabassey-pdp-product-resource-hints';

describe('OgabasseyPdpProductResourceHints', () => {
  beforeEach(() => {
    mockGetImageProps.mockClear();
    mockPreload.mockClear();
  });

  it('renders an early preload link for the primary product image with the gallery sizes', () => {
    const productImage =
      'https://cdn.ogabassey.com/core-assets/products/lenovo-legion.avif';

    const html = renderToStaticMarkup(
      createElement(OgabasseyPdpProductResourceHints, { src: productImage })
    );

    expect(mockGetImageProps).toHaveBeenCalledWith(
      expect.objectContaining({
        loader: expect.any(Function),
        quality: 70,
        sizes: OGABASSEY_PDP_PRIMARY_IMAGE_SIZES,
        src: productImage,
      })
    );
    expect(html).toContain('rel="preload"');
    expect(html).toContain('as="image"');
    expect(html).toMatch(/fetchpriority="high"/i);
    expect(html).toContain(
      `href="${imageLoader({ src: productImage, width: 640, quality: 70 })}"`
    );
    expect(html).toContain(`imageSizes="${OGABASSEY_PDP_PRIMARY_IMAGE_SIZES}"`);
    expect(html).toMatch(/imageSrcSet="[^"]*lenovo-legion\.avif/);
    expect(html).toContain(
      imageLoader({ src: productImage, width: 640, quality: 70 })
    );
    expect(html).toContain('type="image/webp"');
  });

  it('uses the fallback URL extension when the image is not CDN transformed', () => {
    const productImage =
      'https://assets.example.com/products/lenovo-legion.png';

    const html = renderToStaticMarkup(
      createElement(OgabasseyPdpProductResourceHints, { src: productImage })
    );

    expect(html).toContain('type="image/png"');
  });

  it('imperatively preloads the primary product image during server render', () => {
    const productImage =
      'https://cdn.ogabassey.com/core-assets/products/lenovo-legion.avif';

    preloadOgabasseyPdpProductImage({ src: productImage });

    expect(mockPreload).toHaveBeenCalledWith(
      imageLoader({ src: productImage, width: 640, quality: 70 }),
      {
        as: 'image',
        fetchPriority: 'high',
        imageSizes: OGABASSEY_PDP_PRIMARY_IMAGE_SIZES,
        imageSrcSet: expect.stringContaining('lenovo-legion.avif 640w'),
        type: 'image/webp',
      }
    );
  });

  it('skips empty product image URLs', () => {
    const html = renderToStaticMarkup(
      createElement(OgabasseyPdpProductResourceHints, { src: '' })
    );

    expect(html).toBe('');
    expect(mockGetImageProps).not.toHaveBeenCalled();
    preloadOgabasseyPdpProductImage({ src: '' });
    expect(mockPreload).not.toHaveBeenCalled();
  });

  it('skips null product image URLs', () => {
    const html = renderToStaticMarkup(
      createElement(OgabasseyPdpProductResourceHints, { src: null })
    );

    expect(html).toBe('');
    expect(mockGetImageProps).not.toHaveBeenCalled();
  });

  it('skips undefined product image URLs', () => {
    const html = renderToStaticMarkup(
      createElement(OgabasseyPdpProductResourceHints, { src: undefined })
    );

    expect(html).toBe('');
    expect(mockGetImageProps).not.toHaveBeenCalled();
  });
});
