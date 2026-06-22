import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGadgetPattern = vi.hoisted(() => vi.fn());
const mockMobileCarousel = vi.hoisted(() => vi.fn());
const mockDesktopGrid = vi.hoisted(() => vi.fn());

vi.mock('./hero-mobile-carousel', () => ({
  HeroMobileCarousel: (props: Record<string, unknown>) => {
    mockMobileCarousel(props);
    return <div data-testid="mobile-carousel" />;
  },
}));

vi.mock('./hero-desktop-grid', () => ({
  HeroDesktopGrid: (props: Record<string, unknown>) => {
    mockDesktopGrid(props);
    return <div data-testid="desktop-grid" />;
  },
}));

vi.mock('./GadgetPattern', () => ({
  GadgetPattern: (props: { opacity?: number }) => {
    mockGadgetPattern(props);
    return <div data-testid="gadget-pattern" />;
  },
}));

vi.mock('./hero-utility-panel', () => ({
  HeroUtilityPanel: () => <div data-testid="utility-panel">Utility panel</div>,
}));

import { Hero } from './Hero';
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
];

describe('Hero', () => {
  beforeEach(() => {
    mockGadgetPattern.mockClear();
    mockMobileCarousel.mockClear();
    mockDesktopGrid.mockClear();
  });

  it('renders the sr-only storefront heading', () => {
    render(<Hero slides={SLIDES} />);

    expect(
      screen.getByRole('heading', { level: 1, name: /buy phones/i })
    ).toBeInTheDocument();
  });

  it('threads the launch slides to both the mobile carousel and the desktop grid', () => {
    render(<Hero slides={SLIDES} />);

    expect(mockMobileCarousel.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ slides: SLIDES })
    );
    expect(mockDesktopGrid.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ slides: SLIDES })
    );
  });

  it('extends the patterned mobile shell behind the carousel', () => {
    const { container } = render(<Hero slides={SLIDES} />);

    const mobileBackground = container.querySelector(
      '[data-ogabassey-mobile-hero-bg-extension="true"]'
    );

    expect(mobileBackground).toHaveClass(
      'h-28',
      'bg-[var(--ogabassey-shell-background)]'
    );
    expect(screen.getByTestId('gadget-pattern')).toBeInTheDocument();
    expect(mockGadgetPattern).toHaveBeenCalledWith({ opacity: 0.1 });
  });

  it('renders the utility panel chunk in the hero shell', () => {
    render(<Hero slides={SLIDES} />);

    expect(screen.getByTestId('utility-panel')).toBeInTheDocument();
  });
});
