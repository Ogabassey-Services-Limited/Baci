import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HERO_MOBILE_LCP_FALLBACK_SRC,
  HERO_MOBILE_LCP_SRC,
} from './hero-data';
import { TRANSPARENT_PIXEL_SRC } from './hero-mobile-image-config';
import { MobileLcpHeroImage } from './mobile-lcp-hero-image';

const mockGetImageProps = vi.hoisted(() =>
  vi.fn(
    (props: Record<string, unknown>): { props: Record<string, unknown> } => ({
      props: {
        alt: props.alt,
        decoding: props.decoding,
        fetchPriority: props.fetchPriority,
        height: props.height,
        loading: props.loading,
        sizes: props.sizes,
        src: props.src,
        srcSet: `${String(props.src)} 640w, ${String(props.src)} 960w`,
        width: props.width,
      },
    })
  )
);

vi.mock('next/image', () => ({
  getImageProps: mockGetImageProps,
}));

describe('MobileLcpHeroImage', () => {
  beforeEach(() => {
    mockGetImageProps.mockClear();
  });

  it('renders viewport-scoped AVIF and JPEG sources without adding a head preload', () => {
    document.head.replaceChildren();

    const { container } = render(
      <MobileLcpHeroImage
        alt="iPhone 17 Pro Max"
        imageFit="contain"
        shouldPrioritizeImage={true}
        src={HERO_MOBILE_LCP_SRC}
      />
    );

    expect(mockGetImageProps).toHaveBeenCalledWith(
      expect.objectContaining({
        decoding: 'sync',
        fetchPriority: 'high',
        loading: 'eager',
        src: HERO_MOBILE_LCP_SRC,
        unoptimized: true,
      })
    );
    expect(mockGetImageProps).toHaveBeenCalledWith(
      expect.objectContaining({
        loading: 'lazy',
        src: HERO_MOBILE_LCP_FALLBACK_SRC,
        unoptimized: true,
      })
    );
    expect(
      document.head.querySelector(
        `link[rel="preload"][href="${HERO_MOBILE_LCP_SRC}"]`
      )
    ).toBeNull();

    const lcpImage = screen.getByRole('img', {
      name: 'iPhone 17 Pro Max',
    });
    expect(lcpImage).toHaveAttribute('loading', 'eager');
    expect(lcpImage).toHaveAttribute('decoding', 'sync');
    expect(lcpImage).toHaveAttribute('src', TRANSPARENT_PIXEL_SRC);
    expect(lcpImage).toHaveAttribute('fetchpriority', 'high');
    expect(lcpImage).not.toHaveAttribute('srcset');

    const mobileAvifSource = container.querySelector(
      'source[type="image/avif"][media="(max-width: 767px)"]'
    );
    expect(mobileAvifSource).toHaveAttribute(
      'srcset',
      expect.stringContaining(HERO_MOBILE_LCP_SRC)
    );
    expect(mobileAvifSource).toHaveAttribute(
      'sizes',
      '(max-width: 767px) 100vw, 50vw'
    );
    expect(
      container.querySelector(
        'source[type="image/jpeg"][media="(max-width: 767px)"]'
      )
    ).toHaveAttribute(
      'srcset',
      expect.stringContaining(HERO_MOBILE_LCP_FALLBACK_SRC)
    );
  });

  it('omits sizes when unoptimized image props return a single srcSet candidate', () => {
    mockGetImageProps
      .mockImplementationOnce((props: Record<string, unknown>) => ({
        props: {
          alt: props.alt,
          decoding: props.decoding,
          fetchPriority: props.fetchPriority,
          height: props.height,
          loading: props.loading,
          sizes: props.sizes,
          src: props.src,
          width: props.width,
        },
      }))
      .mockImplementationOnce((props: Record<string, unknown>) => ({
        props: {
          alt: props.alt,
          decoding: props.decoding,
          height: props.height,
          loading: props.loading,
          sizes: props.sizes,
          src: props.src,
          width: props.width,
        },
      }));

    const { container } = render(
      <MobileLcpHeroImage
        alt="iPhone 17 Pro Max"
        imageFit="contain"
        shouldPrioritizeImage={true}
        src={HERO_MOBILE_LCP_SRC}
      />
    );

    expect(
      container.querySelector('source[type="image/avif"]')
    ).not.toHaveAttribute('sizes');
    expect(
      container.querySelector('source[type="image/jpeg"]')
    ).not.toHaveAttribute('sizes');
    expect(
      screen.getByRole('img', { name: 'iPhone 17 Pro Max' })
    ).not.toHaveAttribute('sizes');
  });

  it('keeps the fallback image transparent and lets picture sources select the asset', () => {
    render(
      <MobileLcpHeroImage
        alt="iPhone 17 Pro Max"
        imageFit="contain"
        shouldPrioritizeImage={false}
        src={HERO_MOBILE_LCP_SRC}
      />
    );

    const lcpImage = screen.getByRole('img', {
      name: 'iPhone 17 Pro Max',
    });
    expect(lcpImage).toHaveAttribute(
      'src',
      expect.stringMatching(/^data:image\/gif/)
    );
    expect(lcpImage).not.toHaveAttribute('fetchpriority');
    expect(lcpImage).not.toHaveAttribute('srcset');
  });
});
