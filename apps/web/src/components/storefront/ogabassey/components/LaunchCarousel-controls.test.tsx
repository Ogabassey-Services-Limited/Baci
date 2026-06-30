import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { fill: _fill, ...rest } = props;
    return <img {...rest} alt={String(props.alt ?? '')} />;
  },
}));
vi.mock('next/link', () => ({
  default: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a {...props}>{children}</a>,
}));
const mockReducedMotion = vi.hoisted(() => ({ value: false }));
vi.mock('@/hooks/use-reduced-motion', () => ({
  useReducedMotion: () => mockReducedMotion.value,
}));

import { LaunchCarousel, type LaunchSlide } from './LaunchCarousel';

afterEach(() => {
  mockReducedMotion.value = false;
});

const PRODUCT_SLIDES: LaunchSlide[] = [
  {
    kind: 'product',
    id: 'a27',
    name: 'Samsung Galaxy A27 5G Preorder',
    priceLabel: '₦50,000',
    href: '/ogabassey/smartphones/samsung-galaxy-a27-5g',
    imageUrl: 'https://cdn.ogabassey.com/core-assets/products/a27.avif',
    imageAlt: 'Samsung Galaxy A27 5G — Samsung',
    ctaLabel: 'Pre-order now',
  },
  {
    kind: 'product',
    id: 'power80',
    name: 'Itel Power 80',
    priceLabel: '₦173,860',
    href: '/ogabassey/smartphones/itel-power-80-128gb-4gb',
    imageUrl: 'https://cdn.ogabassey.com/core-assets/products/power80.avif',
    imageAlt: 'Itel Power 80 — Itel',
    ctaLabel: 'Shop now',
  },
];

const regionName = 'Just launched products';
const visibleIndex = (container: HTMLElement) =>
  Array.from(
    container.querySelectorAll('[aria-roledescription="slide"]')
  ).findIndex((slide) => slide.getAttribute('aria-hidden') === 'false');

describe('LaunchCarousel controls & autoplay', () => {
  it('suppresses the slide PDP click after a handled swipe', () => {
    const { container } = render(<LaunchCarousel slides={PRODUCT_SLIDES} />);
    const region = screen.getByRole('region', { name: regionName });

    // Swipe left far enough to navigate (> 50px); end X comes from the event.
    fireEvent.touchStart(region, { targetTouches: [{ clientX: 200 }] });
    fireEvent.touchEnd(region, { changedTouches: [{ clientX: 110 }] });

    // The synthesized post-swipe click on a slide link must be cancelled.
    const link = container.querySelector('a[href]') as HTMLElement;
    expect(fireEvent.click(link)).toBe(false);
  });

  it('lets a normal tap (no swipe) reach the slide link', () => {
    const { container } = render(<LaunchCarousel slides={PRODUCT_SLIDES} />);
    const region = screen.getByRole('region', { name: regionName });

    fireEvent.touchStart(region, { targetTouches: [{ clientX: 200 }] });
    fireEvent.touchEnd(region, { changedTouches: [{ clientX: 196 }] });

    const link = container.querySelector('a[href]') as HTMLElement;
    expect(fireEvent.click(link)).toBe(true);
  });

  it('resets the autoplay timer on manual navigation (no double-advance)', () => {
    vi.useFakeTimers();
    try {
      const { container } = render(<LaunchCarousel slides={PRODUCT_SLIDES} />);

      expect(visibleIndex(container)).toBe(0);
      // Almost a full 6s interval elapses on slide 1.
      act(() => {
        vi.advanceTimersByTime(5800);
      });
      // User manually jumps to slide 2.
      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Go to slide 2' }));
      });
      expect(visibleIndex(container)).toBe(1);
      // Past the *original* boundary, but only 0.5s since the manual nav — the
      // timer reset means no immediate second advance.
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(visibleIndex(container)).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('pauses autoplay while a touch gesture is active', () => {
    vi.useFakeTimers();
    try {
      const { container } = render(<LaunchCarousel slides={PRODUCT_SLIDES} />);
      const region = screen.getByRole('region', { name: regionName });

      expect(visibleIndex(container)).toBe(0);
      // Hold a touch — autoplay must not advance the slide under the finger.
      act(() => {
        fireEvent.touchStart(region, { targetTouches: [{ clientX: 150 }] });
      });
      act(() => {
        vi.advanceTimersByTime(6000);
      });
      expect(visibleIndex(container)).toBe(0);

      // Release as a tap (no swipe) — autoplay resumes.
      act(() => {
        fireEvent.touchEnd(region, { changedTouches: [{ clientX: 150 }] });
      });
      act(() => {
        vi.advanceTimersByTime(6000);
      });
      expect(visibleIndex(container)).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('renders a pause/play control that toggles autoplay (WCAG 2.2.2)', () => {
    render(<LaunchCarousel slides={PRODUCT_SLIDES} />);

    const pause = screen.getByRole('button', { name: 'Pause auto-rotation' });
    fireEvent.click(pause);
    expect(
      screen.getByRole('button', { name: 'Play auto-rotation' })
    ).toBeDefined();
  });

  it('resumes autoplay on Play even while the toggle holds focus', () => {
    vi.useFakeTimers();
    try {
      const { container } = render(<LaunchCarousel slides={PRODUCT_SLIDES} />);

      const pause = screen.getByRole('button', { name: 'Pause auto-rotation' });
      // The toggle is outside the carousel panel, so focusing it must NOT pause
      // autoplay (which would otherwise keep rotation stopped after Play).
      fireEvent.focusIn(pause);
      fireEvent.click(pause);
      fireEvent.click(screen.getByRole('button', { name: 'Play auto-rotation' }));

      act(() => {
        vi.advanceTimersByTime(6000);
      });
      expect(visibleIndex(container)).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('hides the pause/play control when reduced motion is preferred', () => {
    mockReducedMotion.value = true;
    render(<LaunchCarousel slides={PRODUCT_SLIDES} />);

    expect(screen.queryByRole('button', { name: /auto-rotation/i })).toBeNull();
  });

  it('shows navigation dots only when there is more than one slide', () => {
    const { rerender } = render(<LaunchCarousel slides={PRODUCT_SLIDES} />);
    expect(screen.getAllByRole('button', { name: /Go to slide/ })).toHaveLength(
      2
    );

    rerender(<LaunchCarousel slides={[PRODUCT_SLIDES[0]]} />);
    expect(
      screen.queryAllByRole('button', { name: /Go to slide/ })
    ).toHaveLength(0);
  });
});
