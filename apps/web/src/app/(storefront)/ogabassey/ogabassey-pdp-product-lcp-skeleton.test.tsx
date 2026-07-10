import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CachedMerchant } from '@/lib/cached-data';
import { OgabasseyPdpProductLcpSkeleton } from './ogabassey-pdp-product-lcp-skeleton';

vi.mock('server-only', () => ({}));

// Build src/srcSet by calling the REAL shared loader the skeleton passes in, so
// the mock produces genuine explicit-format transform URLs (jpeg fallback tier)
// and `buildOgabasseyAvifSrcSet` can derive the AVIF `<source>` from them.
const mockGetImageProps = vi.hoisted(() =>
  vi.fn(
    (props: {
      alt?: string;
      loader: (params: {
        quality?: number;
        src: string;
        width: number;
      }) => string;
      priority?: boolean;
      quality?: number;
      sizes?: string;
      src: string;
    }) => {
      const build = (width: number) =>
        props.loader({ quality: props.quality, src: props.src, width });
      const widths = [640, 750, 828, 1080, 1200];
      return {
        props: {
          alt: props.alt,
          fill: true,
          loader: () => 'should-not-render',
          loading: props.priority ? undefined : 'lazy',
          priority: props.priority,
          quality: props.quality,
          sizes: props.sizes,
          src: build(1200),
          srcSet: widths.map((w) => `${build(w)} ${w}w`).join(', '),
          style: { height: '100%', position: 'absolute', width: '100%' },
        },
      };
    }
  )
);

vi.mock('next/image', () => ({
  getImageProps: mockGetImageProps,
}));

const CDN_PRODUCT_IMAGE =
  'https://cdn.ogabassey.com/core-assets/products/lenovo.avif';

const mockMerchant = {
  id: 'merchant-123',
  template_id: 'ogabassey',
};

describe('OgabasseyPdpProductLcpSkeleton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null if merchant does not match template', () => {
    const { container } = render(
      <OgabasseyPdpProductLcpSkeleton
        merchant={
          {
            ...mockMerchant,
            template_id: 'default',
          } as unknown as CachedMerchant
        }
        primaryProductImage={CDN_PRODUCT_IMAGE}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders general pulsator fallback if primary LCP image is missing', () => {
    render(
      <OgabasseyPdpProductLcpSkeleton
        merchant={mockMerchant as unknown as CachedMerchant}
        primaryProductImage={null}
      />
    );

    const skeleton = screen.getByRole('status', {
      name: /loading product details/i,
    });
    expect(skeleton).toBeDefined();
    expect(skeleton.className).toContain('animate-pulse');
    expect(skeleton.getAttribute('aria-busy')).toBe('true');
  });

  it('paints an explicit per-format <picture> LCP image (AVIF source + jpeg fallback img) when an LCP image exists', () => {
    render(
      <OgabasseyPdpProductLcpSkeleton
        merchant={mockMerchant as unknown as CachedMerchant}
        primaryProductImage={CDN_PRODUCT_IMAGE}
        productName="Lenovo Legion Pro 9"
      />
    );

    const skeleton = screen.getByRole('status', {
      name: /loading product details/i,
    });
    expect(skeleton).toBeDefined();
    expect(skeleton.className).not.toContain('animate-pulse');

    const img = screen.getByRole('img', {
      name: /lenovo legion pro 9/i,
    }) as HTMLImageElement;
    expect(img).toBeDefined();

    // The <img> tier serves the universally decodable jpeg fallback URL — never
    // a poisonable format=auto body.
    expect(img.getAttribute('src')).toContain(
      '/image/width=1200,quality=35,format=jpeg/core-assets/products/lenovo.avif'
    );
    expect(img.getAttribute('srcset')).toContain('format=jpeg');
    expect(img.getAttribute('srcset')).not.toContain('format=auto');
    expect(img.getAttribute('srcset')).not.toContain('format=avif');

    // Instant-paint LCP attributes survive the migration.
    expect(img.style.position).toBe('absolute');
    expect(['0', '0px']).toContain(img.style.inset);
    expect(img.style.height).toBe('100%');
    expect(img.style.width).toBe('100%');
    expect(img.style.objectFit).toBe('cover');
    expect(img.getAttribute('fetchpriority')).toBe('high');
    expect(img.getAttribute('decoding')).toBe('sync');
    expect(img.getAttribute('fill')).toBeNull();
    expect(img.getAttribute('loader')).toBeNull();
    expect(img.getAttribute('priority')).toBeNull();
    expect(img.getAttribute('quality')).toBeNull();
    expect(img.getAttribute('loading')).toBeNull();

    // The AVIF <source> the ~93% AVIF-capable browsers paint — same widths,
    // format=avif only.
    const picture = img.parentElement as HTMLElement;
    expect(picture.tagName).toBe('PICTURE');
    expect(picture.style.display).toBe('contents');
    const source = picture.querySelector('source') as HTMLSourceElement;
    expect(source.getAttribute('type')).toBe('image/avif');
    expect(source.getAttribute('srcset')).toContain('format=avif');
    expect(source.getAttribute('srcset')).not.toContain('format=jpeg');
    expect(source.getAttribute('srcset')).not.toContain('format=auto');

    // display:contents keeps the absolutely-positioned img resolving against
    // the relative frame, not the picture.
    const imageFrame = picture.parentElement as HTMLElement;
    expect(imageFrame.style.position).toBe('relative');
    expect(imageFrame.style.aspectRatio).toBe('1 / 1');
    expect(imageFrame.style.width).toBe('100%');
    expect(imageFrame.style.overflow).toBe('hidden');
    expect(imageFrame.getAttribute('style')).toContain('var(--muted)');
    expect(imageFrame.getAttribute('style')).toContain('var(--border)');
  });

  it('paints a source-less <picture> (bare img) for a non-CDN LCP image with no AVIF twin', () => {
    render(
      <OgabasseyPdpProductLcpSkeleton
        merchant={mockMerchant as unknown as CachedMerchant}
        primaryProductImage="https://assets.example.com/products/lenovo.png"
        productName="Lenovo Legion Pro 9"
      />
    );

    const img = screen.getByRole('img', {
      name: /lenovo legion pro 9/i,
    }) as HTMLImageElement;
    const picture = img.parentElement as HTMLElement;
    expect(picture.tagName).toBe('PICTURE');
    expect(picture.querySelector('source')).toBeNull();
  });
});
