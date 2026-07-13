import { act, fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  // jsdom has no matchMedia; default to "no reduced-motion preference".
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

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

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
    <a href={href} data-prefetch={String(prefetch)} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => (
    <img
      {...Object.fromEntries(
        Object.entries(props).filter(
          ([key]) => key !== 'fill' && key !== 'priority'
        )
      )}
      alt={String(props.alt ?? '')}
    />
  ),
  getImageProps: vi.fn((props: Record<string, unknown>) => ({ props })),
}));

import { HeroMobileCarousel } from './hero-mobile-carousel';
import type { LaunchProductSlide } from './LaunchCarousel';

const SLIDES: LaunchProductSlide[] = [
  {
    kind: 'product',
    id: '1',
    name: 'Samsung Galaxy A27 5G',
    priceLabel: '₦50,000',
    href: '/ogabassey/smartphones/samsung-galaxy-a27-5g',
    imageUrl: 'https://cdn.ogabassey.com/products/a27.avif',
    imageAlt: 'Samsung Galaxy A27 5G',
    ctaLabel: 'Pre-order now',
  },
  {
    kind: 'product',
    id: '2',
    name: 'Itel Power 80',
    priceLabel: '₦60,000',
    href: '/ogabassey/smartphones/itel-power-80-128gb-4gb',
    imageUrl: 'https://cdn.ogabassey.com/products/power80.avif',
    imageAlt: 'Itel Power 80',
    ctaLabel: 'Shop now',
  },
];

const panelName = /featured launch product carousel/i;

describe('HeroMobileCarousel autoplay & gestures', () => {
  it('advances to the next slide on a left swipe', () => {
    render(<HeroMobileCarousel slides={SLIDES} />);

    expect(
      screen.queryByRole('img', { name: 'Itel Power 80' })
    ).not.toBeInTheDocument();

    const panel = screen.getByRole('region', { name: panelName });
    fireEvent.touchStart(panel, { touches: [{ clientX: 220 }] });
    fireEvent.touchEnd(panel, { changedTouches: [{ clientX: 60 }] });

    expect(
      screen.getByRole('img', { name: 'Itel Power 80' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /go to hero slide 2/i })
    ).toHaveAttribute('aria-current', 'true');
  });

  it('does not auto-advance until the user explicitly starts rotation', () => {
    vi.useFakeTimers();
    render(<HeroMobileCarousel slides={SLIDES} />);

    expect(
      screen.queryByRole('img', { name: 'Itel Power 80' })
    ).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(
      screen.queryByRole('img', { name: 'Itel Power 80' })
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /play auto-rotation/i })
    );
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(
      screen.getByRole('img', { name: 'Itel Power 80' })
    ).toBeInTheDocument();
  });

  it('does not create progress animation work until Play is pressed', () => {
    const animate = vi.fn(() =>
      ({
        cancel: vi.fn(),
        pause: vi.fn(),
        play: vi.fn(),
      }) as unknown as Animation
    );
    const originalAnimate = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'animate'
    );
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      value: animate,
    });

    try {
      render(<HeroMobileCarousel slides={SLIDES} />);

      expect(animate).not.toHaveBeenCalled();

      fireEvent.click(
        screen.getByRole('button', { name: /play auto-rotation/i })
      );

      expect(animate).toHaveBeenCalledTimes(1);
    } finally {
      if (originalAnimate) {
        Object.defineProperty(
          HTMLElement.prototype,
          'animate',
          originalAnimate
        );
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, 'animate');
      }
    }
  });

  it('resumes auto-advance after a cancelled touch (touchcancel)', () => {
    vi.useFakeTimers();
    render(<HeroMobileCarousel slides={SLIDES} />);

    fireEvent.click(
      screen.getByRole('button', { name: /play auto-rotation/i })
    );
    const panel = screen.getByRole('region', { name: panelName });

    // A touch pauses autoplay, so the slide does not advance while held.
    fireEvent.touchStart(panel, { touches: [{ clientX: 200 }] });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(
      screen.queryByRole('img', { name: 'Itel Power 80' })
    ).not.toBeInTheDocument();

    // A cancelled gesture (e.g. the browser hijacks it for a vertical scroll)
    // must clear the pause so autoplay resumes.
    fireEvent.touchCancel(panel);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(
      screen.getByRole('img', { name: 'Itel Power 80' })
    ).toBeInTheDocument();
  });

  it('pauses auto-advance while keyboard focus is inside the carousel', () => {
    vi.useFakeTimers();
    render(<HeroMobileCarousel slides={SLIDES} />);

    fireEvent.click(
      screen.getByRole('button', { name: /play auto-rotation/i })
    );
    const link = screen.getByRole('link', {
      name: 'Samsung Galaxy A27 5G — Pre-order now',
    });
    fireEvent.focusIn(link);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(
      screen.queryByRole('img', { name: 'Itel Power 80' })
    ).not.toBeInTheDocument();

    // Moving focus out of the carousel resumes autoplay.
    fireEvent.focusOut(link, { relatedTarget: document.body });
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(
      screen.getByRole('img', { name: 'Itel Power 80' })
    ).toBeInTheDocument();
  });

  it('does not auto-advance when reduced motion is preferred', () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query.includes('reduce'),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
    );
    render(<HeroMobileCarousel slides={SLIDES} />);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(
      screen.queryByRole('img', { name: 'Itel Power 80' })
    ).not.toBeInTheDocument();
    // No persistent pause control is shown when there is no autoplay to pause.
    expect(
      screen.queryByRole('button', { name: /auto-rotation/i })
    ).not.toBeInTheDocument();
    expect(
      document.querySelector(
        '[data-ogabassey-carousel-toggle-slot="reserved"]'
      )
    ).toHaveClass('h-11', 'min-w-11');
  });

  it('stops auto-advance when the persistent pause control is pressed (WCAG 2.2.2)', () => {
    vi.useFakeTimers();
    render(<HeroMobileCarousel slides={SLIDES} />);

    fireEvent.click(
      screen.getByRole('button', { name: /play auto-rotation/i })
    );
    fireEvent.click(
      screen.getByRole('button', { name: /pause auto-rotation/i })
    );

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(
      screen.queryByRole('img', { name: 'Itel Power 80' })
    ).not.toBeInTheDocument();
    // The control now offers to resume.
    expect(
      screen.getByRole('button', { name: /play auto-rotation/i })
    ).toBeInTheDocument();
  });

  it('resumes autoplay on Play even while the toggle holds focus', () => {
    vi.useFakeTimers();
    render(<HeroMobileCarousel slides={SLIDES} />);

    fireEvent.click(
      screen.getByRole('button', { name: /play auto-rotation/i })
    );
    const toggle = screen.getByRole('button', { name: /pause auto-rotation/i });
    // The toggle lives outside the carousel panel, so focusing it must NOT
    // trigger the panel's focus-within pause (which would otherwise keep
    // rotation paused after the user presses Play).
    fireEvent.focusIn(toggle);
    fireEvent.click(toggle); // pause
    fireEvent.click(
      screen.getByRole('button', { name: /play auto-rotation/i })
    ); // resume

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(
      screen.getByRole('img', { name: 'Itel Power 80' })
    ).toBeInTheDocument();
  });
});
