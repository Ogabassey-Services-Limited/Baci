import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';

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
 */
function expectStyleDeclarations(style: string | null, declarations: string[]) {
  const serializedStyle = style ?? '';
  for (const declaration of declarations) {
    expect(serializedStyle).toContain(declaration);
  }
}

function renderHero() {
  return render(
    <HeroMobileCarousel
      getHref={(path) => `/ogabassey${path}`}
      hasResolvedViewport={true}
      isDesktopViewport={false}
    />
  );
}

describe('HeroMobileCarousel', () => {
  it('renders a single product slide with no demo video or sponsored ad', () => {
    const { container } = renderHero();

    expect(
      screen.getByRole('heading', { name: 'iPhone 17 Pro Max' })
    ).toBeInTheDocument();
    // The Google sample video + hero ad slides were removed.
    expect(container.querySelector('video')).toBeNull();
    // A single static slide has no rotating-carousel controls.
    expect(
      screen.queryByRole('group', { name: /hero carousel slide controls/i })
    ).toBeNull();
  });

  it('uses theme variables for the hero CTA', () => {
    renderHero();

    expectStyleDeclarations(
      screen.getAllByRole('link', { name: /shop now/i })[0].getAttribute('style'),
      HERO_CTA_EXPECTED_DECLARATIONS
    );
  });

  it('disables prefetch on the hero product call to action', () => {
    renderHero();

    for (const link of screen.getAllByRole('link', { name: /shop now/i })) {
      expect(link).toHaveAttribute('data-prefetch', 'false');
    }
  });

  it('uses a mobile-friendly touch target for the hero CTA', () => {
    renderHero();

    for (const link of screen.getAllByRole('link', { name: /shop now/i })) {
      expect(link).toHaveClass('min-h-12');
    }
  });

  it('keeps the hero media inside the clipped carousel panel', () => {
    const { container } = renderHero();

    const carouselPanel = container.querySelector(
      '[data-ogabassey-mobile-hero-panel="true"]'
    );
    expect(carouselPanel).toHaveClass('overflow-hidden');
  });

  it('keeps the first mobile hero copy in a separate column from its media rail', () => {
    const { container } = renderHero();

    const firstSlideHeading = screen.getByRole('heading', {
      name: 'iPhone 17 Pro Max',
    });
    const copyColumn = firstSlideHeading.closest(
      '[data-ogabassey-mobile-hero-copy="true"]'
    );
    const mediaRail = container.querySelector(
      '[data-ogabassey-mobile-hero-media="true"]'
    );

    expect(copyColumn).toHaveClass('w-[46%]', 'pr-2');
    expect(mediaRail).toHaveClass('right-4', 'w-[43%]');
  });
});
