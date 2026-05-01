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

const STORE_FALLBACK_PRIMARY = '#d62027';
const STORE_FALLBACK_BORDER = 'rgba(214, 32, 39, 0.24)';
const STORE_FALLBACK_ON_PRIMARY = '#ffffff';
const HERO_CTA_EXPECTED_DECLARATIONS = [
  `background-color: var(--store-primary, ${STORE_FALLBACK_PRIMARY});`,
  `border-color: var(--store-border, ${STORE_FALLBACK_BORDER});`,
  `color: var(--store-on-primary, ${STORE_FALLBACK_ON_PRIMARY});`,
];

/**
 * Asserts that a serialized style string contains the expected declarations.
 * A missing style is treated as an empty string, so it still fails normally.
 * Matching remains sensitive to CSS whitespace and semicolon formatting.
 */
function expectStyleDeclarations(
  style: string | null,
  declarations: string[]
) {
  const serializedStyle = style ?? '';
  for (const declaration of declarations) {
    expect(serializedStyle).toContain(declaration);
  }
}

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

    expectStyleDeclarations(
      screen.getAllByRole('link', { name: /shop now/i })[0].getAttribute('style'),
      HERO_CTA_EXPECTED_DECLARATIONS
    );
    expectStyleDeclarations(
      screen
        .getByRole('button', { name: /watch video demo/i })
        .getAttribute('style'),
      HERO_CTA_EXPECTED_DECLARATIONS
    );

    const activeIndicator = screen
      .getByRole('button', { name: /go to hero slide 1/i })
      .querySelector('span');
    expect(activeIndicator).toHaveClass('w-5');
    expectStyleDeclarations(activeIndicator?.getAttribute('style') ?? null, [
      `background-color: var(--store-primary, ${STORE_FALLBACK_PRIMARY});`,
      'opacity: 1;',
    ]);
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
