import { render } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OgabasseyHomeHeroFallback } from '@/app/(storefront)/ogabassey/ogabassey-home-hero-fallback';
import { HeroMobileCarousel } from './hero-mobile-carousel';

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    prefetch,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    prefetch?: boolean;
  } & Record<string, unknown>) => (
    <a data-prefetch={String(prefetch)} href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('next/image', () => ({
  default: () => null,
  getImageProps: vi.fn(({ sizes, src }) => ({
    props: { sizes, src, srcSet: `${src} 960w` },
  })),
}));

beforeEach(() => {
  // jsdom has no matchMedia; the carousel's reduced-motion probe needs it.
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  );
});

const SLIDES = [
  {
    kind: 'product' as const,
    id: 'p1',
    name: 'Tecno Spark 40 Pro',
    priceLabel: '₦250,000',
    href: '/smartphones/tecno-spark-40-pro',
    imageUrl: 'https://cdn.ogabassey.com/core-assets/products/tecno.avif',
    imageAlt: 'Tecno Spark 40 Pro',
    ctaLabel: 'Shop now',
  },
  {
    kind: 'product' as const,
    id: 'p2',
    name: 'Dell XPS 16',
    priceLabel: '₦3,500,000',
    href: '/gaming-laptops/dell-xps-16',
    imageUrl: 'https://cdn.ogabassey.com/core-assets/products/dell.avif',
    imageAlt: 'Dell XPS 16',
    ctaLabel: 'Shop now',
  },
];

/**
 * Geometry parity: the PPR-shell fallback's slide-0 frame must be
 * pixel-identical to the interactive carousel's first frame — the home
 * page's 0.37 field CLS came from the fallback→hero swap changing geometry.
 * Both surfaces consume `hero-mobile-geometry.ts`; this test locks the
 * rendered class parity so a one-sided styling change fails loudly.
 */
describe('hero mobile geometry parity (fallback vs carousel first frame)', () => {
  function classesOf(container: HTMLElement, selector: string): string {
    const node = container.querySelector(selector);
    expect(node, `selector not found: ${selector}`).not.toBeNull();
    return (node as HTMLElement).className;
  }

  it('renders the fallback slide-0 frame with the exact carousel first-frame geometry', () => {
    const fallback = render(
      <OgabasseyHomeHeroFallback shellSlides={SLIDES} />
    ).container;
    const carousel = render(<HeroMobileCarousel slides={SLIDES} />).container;

    // Panel box (h-48, rounding, ring, shadow).
    const fallbackPanel = classesOf(
      fallback,
      '[data-ogabassey-shell-mobile-hero-slide]'
    );
    const carouselPanel = classesOf(
      carousel,
      '[data-ogabassey-mobile-hero-panel]'
    );
    expect(fallbackPanel).toBe(carouselPanel);

    // Text column, headline, price, CTA, image column — compare the first
    // slide's structure class-for-class.
    for (const [fallbackSel, carouselSel] of [
      ['h2', 'h2'],
      ['p', '[data-ogabassey-mobile-hero-panel] p'],
    ] as const) {
      expect(classesOf(fallback, fallbackSel)).toBe(
        classesOf(carousel, carouselSel)
      );
    }
  });

  it('reserves the controls row height when multiple slides exist', () => {
    const fallback = render(
      <OgabasseyHomeHeroFallback shellSlides={SLIDES} />
    ).container;

    // One track per slide + the play-toggle slot, all h-11 — the real hero is
    // ~52px taller with this row; omitting it was a slice of the swap CLS.
    const row = fallback.querySelector('.mt-2.flex.items-center');
    expect(row).not.toBeNull();
    expect(row?.querySelectorAll('.h-11').length).toBe(SLIDES.length + 1);
  });

  it('omits the controls row for a single slide (matches HeroEmptyGeometry-adjacent case)', () => {
    const fallback = render(
      <OgabasseyHomeHeroFallback shellSlides={[SLIDES[0]]} />
    ).container;

    expect(fallback.querySelector('.mt-2.flex.items-center')).toBeNull();
  });

  it('renders the fallback slide-0 image with the SAME src/srcset the carousel actually uses', () => {
    const fallback = render(
      <OgabasseyHomeHeroFallback shellSlides={SLIDES} />
    ).container;
    const carousel = render(<HeroMobileCarousel slides={SLIDES} />).container;

    // Both surfaces render slide 0 via MobileLcpHeroImage, which builds its
    // own <picture><source/><img/></picture> from getImageProps — proving the
    // rendered srcset carries SLIDES[0].imageUrl AND is identical between the
    // fallback and the carousel is the actual no-op-swap guarantee; asserting
    // presence alone (without the cross-render comparison) would pass even if
    // the fallback silently drifted from the streamed hero's image.
    const fallbackSource = fallback.querySelector('picture source');
    const carouselSource = carousel.querySelector('picture source');
    expect(fallbackSource?.getAttribute('srcset')).toContain(
      SLIDES[0].imageUrl
    );
    expect(fallbackSource?.getAttribute('srcset')).toBe(
      carouselSource?.getAttribute('srcset')
    );

    const fallbackImg = fallback.querySelector('picture img');
    const carouselImg = carousel.querySelector('picture img');
    expect(fallbackImg?.getAttribute('alt')).toBe(SLIDES[0].imageAlt);
    expect(fallbackImg?.getAttribute('alt')).toBe(
      carouselImg?.getAttribute('alt')
    );
  });
});
