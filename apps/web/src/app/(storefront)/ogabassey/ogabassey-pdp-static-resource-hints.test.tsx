import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

// The mock validates our explicit loader + width contract; deployed HTML
// inspection catches any drift from real Next getImageProps output.
const mockGetImageProps = vi.hoisted(() =>
  vi.fn(
    (props: {
      fill?: boolean;
      loader: (params: {
        src: string;
        width: number;
        quality?: number;
      }) => string;
      quality?: number;
      sizes?: string;
      src: string;
    }) => {
      // Mirrors Next.js default responsive image widths for srcSet generation.
      const widths = [640, 750, 828, 1080, 1200, 1920, 2048, 3840];
      const srcSet = widths
        .map(
          (width) =>
            `${props.loader({
              quality: props.quality,
              src: props.src,
              width,
            })} ${width}w`
        )
        .join(', ');

      return {
        props: {
          sizes: props.sizes,
          src: props.loader({
            quality: props.quality,
            src: props.src,
            width: widths.at(-1) ?? 3840,
          }),
          srcSet,
        },
      };
    }
  )
);

vi.mock('next/image', () => ({
  getImageProps: mockGetImageProps,
}));

import { OgabasseyPdpStaticResourceHints } from '@/app/(storefront)/ogabassey/ogabassey-pdp-static-resource-hints';
import { FLASH_SALE_PROMO_IMAGE } from '@/components/storefront/ogabassey/components/hero-data';
import imageLoader from '@/lib/image-loader';

describe('OgabasseyPdpStaticResourceHints', () => {
  it('emits one desktop-only banner preload that matches the custom image loader', () => {
    const html = renderToString(<OgabasseyPdpStaticResourceHints />);
    const template = document.createElement('template');
    template.innerHTML = html;
    const links = Array.from(template.content.querySelectorAll('link'));

    const findLink = (predicate: (link: HTMLLinkElement) => boolean) =>
      links.find(predicate);

    const bannerPreload = findLink(
      (link) =>
        link.getAttribute('rel') === 'preload' &&
        link.getAttribute('as') === 'image' &&
        link.getAttribute('media') === '(min-width: 768px)'
    );

    expect(bannerPreload).toBeDefined();
    expect(mockGetImageProps).toHaveBeenCalledWith(
      expect.objectContaining({
        fill: true,
        loader: expect.any(Function),
        sizes: '(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1400px',
        src: FLASH_SALE_PROMO_IMAGE,
      })
    );
    expect(bannerPreload?.getAttribute('fetchpriority')).toBe('high');
    // React 19 responsive image preloads omit href when imageSrcSet is
    // supplied; the selectable transformed URLs live in imagesrcset.
    expect(bannerPreload?.getAttribute('href')).toBeNull();
    expect(bannerPreload?.getAttribute('imagesrcset')).toContain(
      imageLoader({ src: FLASH_SALE_PROMO_IMAGE, width: 640 })
    );
    expect(bannerPreload?.getAttribute('imagesrcset')).toContain('quality=75');
    expect(bannerPreload?.getAttribute('imagesrcset')).toContain('format=webp');
    expect(bannerPreload?.getAttribute('imagesizes')).toBe(
      '(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1400px'
    );
    expect(bannerPreload?.getAttribute('type')).toBe('image/webp');

    // Only the banner is preloaded by this hint because the PDP wrapper uses
    // `hidden md:block`, so no mobile-media preload should exist.
    expect(
      links.filter((link) => link.getAttribute('rel') === 'preload')
    ).toHaveLength(1);
    expect(
      links.filter((link) =>
        ['dns-prefetch', 'preconnect'].includes(link.getAttribute('rel') ?? '')
      )
    ).toHaveLength(0);
  });

  it('still emits preload hints when preload type cannot be inferred', () => {
    mockGetImageProps.mockImplementationOnce(() => ({
      props: {
        sizes: '(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1400px',
        src: '/image/banner-without-format',
        srcSet:
          '/image/banner-without-format,width=640 640w, /image/banner-without-format,width=1080 1080w',
      },
    }));

    const html = renderToString(<OgabasseyPdpStaticResourceHints />);
    const template = document.createElement('template');
    template.innerHTML = html;
    const preloads = Array.from(
      template.content.querySelectorAll('link[rel="preload"]')
    );

    expect(preloads.length).toBeGreaterThan(0);
    const bannerPreload = preloads[0];
    expect(bannerPreload?.getAttribute('as')).toBe('image');
    expect(bannerPreload?.getAttribute('imagesrcset')).toContain(
      'banner-without-format'
    );
    expect(bannerPreload?.getAttribute('type')).toBeNull();
  });

  it('infers preload type from query-string loader format parameters', () => {
    mockGetImageProps.mockImplementationOnce(() => ({
      props: {
        sizes: '(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1400px',
        src: '/image/banner?width=3840&format=png&quality=75',
        srcSet:
          '/image/banner?width=640&format=png&quality=75 640w, /image/banner?width=1080&format=png&quality=75 1080w',
      },
    }));

    const html = renderToString(<OgabasseyPdpStaticResourceHints />);
    const template = document.createElement('template');
    template.innerHTML = html;
    const bannerPreload = template.content.querySelector('link[rel="preload"]');

    expect(bannerPreload?.getAttribute('type')).toBe('image/png');
  });
});
