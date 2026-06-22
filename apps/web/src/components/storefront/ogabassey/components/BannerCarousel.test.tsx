import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => (
    <img
      {...Object.fromEntries(
        Object.entries(props).filter(
          ([key]) => key !== 'fill' && key !== 'priority'
        )
      )}
      alt={String(props.alt ?? '')}
      data-priority={String(Boolean(props.priority))}
    />
  ),
}));
vi.mock('next/link', () => ({
  default: ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock('../config/ads', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../config/ads')>();
  return {
    ...actual,
    AD_CONFIG: {},
  };
});
const mockAdUnit = vi.hoisted(() =>
  vi.fn((props: Record<string, unknown>) => (
    <div data-testid="ad-unit">{String(props.placementKey ?? 'Ad')}</div>
  ))
);

vi.mock('./AdUnit', () => ({
  AdUnit: (props: Record<string, unknown>) => mockAdUnit(props),
}));
vi.mock('@/hooks/use-reduced-motion', () => ({
  useReducedMotion: () => false,
}));

import { BannerCarousel, resolveBannerHref } from './BannerCarousel';
import { SPONSORED_SLIDE_AD_BOOT_DELAY_MS } from '../config/ads';

describe('BannerCarousel', () => {
  beforeEach(() => {
    mockAdUnit.mockClear();
  });

  it('renders without crashing', () => {
    const { container } = render(<BannerCarousel />);
    expect(container).toBeDefined();
  });

  it('normalizes relative banner links against the route base path', () => {
    expect(resolveBannerHref('/ogabassey', 'products')).toBe(
      '/ogabassey/products'
    );
    expect(resolveBannerHref('/ogabassey/', '/products')).toBe(
      '/ogabassey/products'
    );
    expect(resolveBannerHref('', '/')).toBe('/');
    expect(resolveBannerHref('/ogabassey', '/')).toBe('/ogabassey');
    expect(resolveBannerHref('/ogabassey', 'https://example.com')).toBe(
      'https://example.com'
    );
  });

  it('renders the promo banners as CSS-only slides with no baked images', () => {
    const { container } = render(<BannerCarousel />);
    const images = Array.from(container.querySelectorAll('img'));

    // Promo slides are now theme-driven CSS, so the homepage banner ships no
    // banner image at all (nothing to preload below the fold).
    expect(images).toHaveLength(0);
    expect(screen.getByText('Flash Sale')).toBeInTheDocument();
    expect(screen.getByText('New Arrivals')).toBeInTheDocument();
  });

  it('eagerly loads only the custom category image with high fetch priority', () => {
    const { container } = render(
      <BannerCarousel categoryImage="/category-banner.avif" />
    );
    const images = Array.from(container.querySelectorAll('img'));

    // Only the category hero is a real image; promo slides remain CSS-only.
    expect(images).toHaveLength(1);
    expect(images[0]).toHaveAttribute('src', '/category-banner.avif');
    expect(images[0]).toHaveAttribute('loading', 'eager');
    expect(images[0]).toHaveAttribute('fetchpriority', 'high');
    // The deprecated `priority` prop is gone.
    expect(images[0]).not.toHaveAttribute('priority');
  });

  it('renders a pause/play control that toggles autoplay (WCAG 2.2.2)', () => {
    render(<BannerCarousel />);

    const pause = screen.getByRole('button', { name: 'Pause auto-rotation' });
    fireEvent.click(pause);
    expect(
      screen.getByRole('button', { name: 'Play auto-rotation' })
    ).toBeDefined();
  });

  it('labels banner slide controls as non-submit buttons', () => {
    render(<BannerCarousel />);

    for (const button of screen.getAllByRole('button', {
      name: /go to banner slide/i,
    })) {
      expect(button).toHaveAttribute('type', 'button');
    }
  });

  it('marks the active control with aria-current and exposes the matching slide as visible to assistive tech', () => {
    const { container } = render(<BannerCarousel />);
    const slideControls = screen.getAllByRole('button', {
      name: /go to banner slide/i,
    });
    const newArrivalsControl = screen.getByRole('button', {
      name: /new arrivals/i,
    });
    // Slides expose ARIA carousel semantics — query by the spec attribute
    // rather than Tailwind class names so the test survives style refactors.
    const slides = Array.from(
      container.querySelectorAll<HTMLElement>(
        '[aria-roledescription="slide"]'
      )
    );

    expect(slides.length).toBe(slideControls.length);

    const visibleSlides = () =>
      slides.filter((slide) => slide.getAttribute('aria-hidden') === 'false');
    expect(visibleSlides()).toHaveLength(1);
    expect(visibleSlides()[0]).not.toBe(slides[slideControls.indexOf(newArrivalsControl)]);

    fireEvent.click(newArrivalsControl);

    const newArrivalsIdx = slideControls.indexOf(newArrivalsControl);
    expect(newArrivalsControl).toHaveAttribute('aria-current', 'true');
    expect(visibleSlides()).toEqual([slides[newArrivalsIdx]]);

    for (const [idx, btn] of slideControls.entries()) {
      if (btn !== newArrivalsControl) {
        expect(btn).not.toHaveAttribute('aria-current');
        expect(slides[idx]).toHaveAttribute('aria-hidden', 'true');
      }
    }
  });

  it('marks non-active slides inert so their focusable descendants are not tabbable', () => {
    const { container } = render(<BannerCarousel />);
    const slides = Array.from(
      container.querySelectorAll<HTMLElement>(
        '[aria-roledescription="slide"]'
      )
    );

    const inertSlides = slides.filter((slide) => slide.hasAttribute('inert'));
    const interactiveSlides = slides.filter(
      (slide) => !slide.hasAttribute('inert')
    );

    // Exactly one slide is interactive at a time; the rest are inert so links
    // like "Shop Now" inside hidden slides cannot receive keyboard focus.
    expect(interactiveSlides).toHaveLength(1);
    expect(inertSlides).toHaveLength(slides.length - 1);
    expect(interactiveSlides[0]).toHaveAttribute('aria-hidden', 'false');
    for (const slide of inertSlides) {
      expect(slide).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('keeps the sponsored slide inactive until it becomes the visible slide', () => {
    render(<BannerCarousel />);

    expect(mockAdUnit).toHaveBeenCalledWith(
      expect.objectContaining({
        placementKey: 'HEADER_LEADERBOARD',
        bootDelayMs: SPONSORED_SLIDE_AD_BOOT_DELAY_MS,
        isActive: false,
      })
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: /sponsored placement/i,
      })
    );

    expect(mockAdUnit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        placementKey: 'HEADER_LEADERBOARD',
        isActive: true,
      })
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: /flash sale/i,
      })
    );

    expect(mockAdUnit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        placementKey: 'HEADER_LEADERBOARD',
        isActive: false,
      })
    );
  });
});
