import { act, fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
      data-priority={String(Boolean(props.priority))}
    />
  ),
  getImageProps: mockGetImageProps,
}));

const mockDeferredAdUnit = vi.hoisted(() =>
  vi.fn(({ placementKey }: { placementKey: string }) => (
    <div data-testid={`ad-${placementKey}`} />
  ))
);

vi.mock('./deferred-ad-unit', () => ({
  DeferredAdUnit: (props: { placementKey: string }) =>
    mockDeferredAdUnit(props),
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
    mockGetImageProps.mockClear();
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

  it('keeps the sponsored ad wrapper mounted across slide changes', () => {
    render(
      <HeroMobileCarousel
        getHref={(path) => `/ogabassey${path}`}
        hasResolvedViewport={true}
        isDesktopViewport={false}
      />
    );

    const sponsoredAdCall = mockDeferredAdUnit.mock.calls.find(
      ([props]) =>
        (props as { placementKey?: string }).placementKey ===
        'HEADER_LEADERBOARD'
    );

    expect(sponsoredAdCall?.[0]).toEqual(
      expect.not.objectContaining({
        enabled: expect.any(Boolean),
      })
    );
  });
});
