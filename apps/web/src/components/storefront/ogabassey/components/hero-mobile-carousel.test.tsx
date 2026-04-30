import { act, fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
}));

vi.mock('./AdUnit', () => ({
  AdUnit: ({ placementKey }: { placementKey: string }) => (
    <div data-testid={`ad-${placementKey}`} />
  ),
}));

import { HeroMobileCarousel } from './hero-mobile-carousel';

describe('HeroMobileCarousel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('keeps autoplay paused until the user interacts', async () => {
    const { container } = render(
      <HeroMobileCarousel
        getHref={(path) => `/ogabassey${path}`}
        hasResolvedViewport={true}
        isDesktopViewport={false}
      />
    );

    expect(container.querySelector('video')).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(6000);
    });

    expect(container.querySelector('video')).toBeNull();

    await act(async () => {
      fireEvent.scroll(window);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /go to hero slide 2/i }));
    });

    expect(container.querySelector('video')).not.toBeNull();
  });

  it('marks only the first mobile hero image as the high-priority LCP candidate', () => {
    render(
      <HeroMobileCarousel
        getHref={(path) => `/ogabassey${path}`}
        hasResolvedViewport={true}
        isDesktopViewport={false}
      />
    );

    const highPriorityImages = screen
      .getAllByRole('img')
      .filter(
        (image) =>
          image.getAttribute('fetchPriority') === 'high' ||
          image.getAttribute('fetchpriority') === 'high'
      );

    expect(highPriorityImages).toHaveLength(1);
    expect(highPriorityImages[0]).toHaveAccessibleName('iPhone 17 Pro Max');
  });

  it('uses theme variables for the hero CTA and slide controls', () => {
    render(
      <HeroMobileCarousel
        getHref={(path) => `/ogabassey${path}`}
        hasResolvedViewport={true}
        isDesktopViewport={false}
      />
    );

    expect(
      screen.getAllByRole('link', { name: /shop now/i })[0].getAttribute('style')
    ).toContain(
      'background-color: var(--store-primary); border-color: var(--store-border); color: var(--store-on-primary);'
    );

    const activeIndicator = screen
      .getByRole('button', { name: /go to hero slide 1/i })
      .querySelector('span');
    expect(activeIndicator).toHaveClass('w-5');
    expect(activeIndicator?.getAttribute('style')).toContain(
      'background-color: var(--store-primary); opacity: 1;'
    );
  });

  it('disables prefetch on hero product calls to action', () => {
    render(
      <HeroMobileCarousel
        getHref={(path) => `/ogabassey${path}`}
        hasResolvedViewport={true}
        isDesktopViewport={false}
      />
    );

    for (const link of screen.getAllByRole('link', { name: /shop now/i })) {
      expect(link).toHaveAttribute('data-prefetch', 'false');
    }
  });

  it('uses mobile-friendly touch targets for the hero CTA and slide controls', () => {
    render(
      <HeroMobileCarousel
        getHref={(path) => `/ogabassey${path}`}
        hasResolvedViewport={true}
        isDesktopViewport={false}
      />
    );

    for (const link of screen.getAllByRole('link', { name: /shop now/i })) {
      expect(link).toHaveClass('min-h-12');
    }

    expect(
      screen.getByRole('button', { name: /go to hero slide 1/i })
    ).toHaveClass('h-12', 'min-w-12');
  });
});
