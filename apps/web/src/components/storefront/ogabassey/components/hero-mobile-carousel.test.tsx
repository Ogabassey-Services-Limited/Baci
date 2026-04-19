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
});

