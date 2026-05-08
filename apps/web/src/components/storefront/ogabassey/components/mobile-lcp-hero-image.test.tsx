import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  HERO_MOBILE_LCP_FALLBACK_SRC,
  HERO_MOBILE_LCP_SRC,
} from './hero-data';
import { MobileLcpHeroImage } from './mobile-lcp-hero-image';

const mockGetImageProps = vi.hoisted(() =>
  vi.fn((props: Record<string, unknown>) => ({
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
  }))
);

vi.mock('next/image', () => ({
  getImageProps: mockGetImageProps,
}));

describe('MobileLcpHeroImage', () => {
  it('renders viewport-scoped AVIF and JPEG sources without adding a head preload', () => {
    document.head.replaceChildren();

    const { container } = render(
      <MobileLcpHeroImage
        alt="iPhone 17 Pro Max"
        imageFit="contain"
        isResolvedMobileViewport={true}
        shouldPrioritizeImage={true}
        src={HERO_MOBILE_LCP_SRC}
      />
    );

    expect(mockGetImageProps).toHaveBeenCalledWith(
      expect.objectContaining({
        fetchPriority: 'high',
        loading: 'eager',
        src: HERO_MOBILE_LCP_SRC,
      })
    );
    expect(mockGetImageProps).toHaveBeenCalledWith(
      expect.objectContaining({
        loading: 'lazy',
        src: HERO_MOBILE_LCP_FALLBACK_SRC,
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
    expect(lcpImage).toHaveAttribute('src', HERO_MOBILE_LCP_FALLBACK_SRC);
    expect(lcpImage).toHaveAttribute('fetchpriority', 'high');
    expect(lcpImage).toHaveAttribute(
      'srcset',
      expect.stringContaining(HERO_MOBILE_LCP_FALLBACK_SRC)
    );

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

  it('keeps the fallback image transparent after resolving a desktop viewport', () => {
    render(
      <MobileLcpHeroImage
        alt="iPhone 17 Pro Max"
        imageFit="contain"
        isResolvedMobileViewport={false}
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
