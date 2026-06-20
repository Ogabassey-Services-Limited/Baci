import { act, render, screen } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches,
      media: '(min-width: 768px)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

const mockUseMerchantSafe = vi.hoisted(() => vi.fn(() => null));
const mockGadgetPattern = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/merchant/use-merchant', () => ({
  useMerchantSafe: () => mockUseMerchantSafe(),
}));

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
  getImageProps: (props: Record<string, unknown>) => ({
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
  }),
}));

vi.mock('next/dynamic', () => ({
  default: (loader: () => Promise<unknown>) => {
    const source = loader.toString();

    if (source.includes('hero-desktop-grid')) {
      return () => <div data-testid="desktop-hero-grid">Desktop hero</div>;
    }

    return () => null;
  },
}));

vi.mock('./hero-mobile-carousel', () => ({
  HeroMobileCarousel: ({ getHref }: { getHref: (path: string) => string }) => (
    <>
      <a href={getHref('/products')}>Shop Now</a>
      <a href={getHref('/')}>Storefront root</a>
    </>
  ),
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

vi.mock('./AdUnit', () => ({
  AdUnit: ({ placementKey }: { placementKey: string }) => (
    <div data-testid={`ad-${placementKey}`} />
  ),
}));

import { Hero } from './Hero';

describe('Hero', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockMatchMedia(false);
    mockGadgetPattern.mockClear();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('renders the utility panel chunk in the hero shell', () => {
    render(<Hero />);

    expect(screen.getByTestId('utility-panel')).toBeInTheDocument();
  });

  it('extends the black patterned mobile shell behind the carousel', () => {
    const { container } = render(<Hero />);

    const mobileBackground = container.querySelector(
      '[data-ogabassey-mobile-hero-bg-extension="true"]'
    );

    expect(mobileBackground).toHaveClass(
      'h-28',
      'bg-[var(--ogabassey-shell-background)]'
    );
    expect(mobileBackground).not.toHaveClass('h-14');
    expect(
      mobileBackground?.querySelector('.bg-linear-to-b')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('gadget-pattern')).toBeInTheDocument();
    expect(mockGadgetPattern).toHaveBeenCalledWith({ opacity: 0.1 });
  });

  it('uses an explicit server-resolved base path for product calls to action', () => {
    render(<Hero basePath="/ogabassey" />);

    expect(
      screen.getAllByRole('link', { name: /shop now/i })[0]
    ).toHaveAttribute('href', '/ogabassey/products');
    expect(mockUseMerchantSafe).not.toHaveBeenCalled();
  });

  it('uses an absolute root href when custom-domain base path is empty', () => {
    render(<Hero basePath="" />);

    expect(screen.getByText('Storefront root')).toHaveAttribute('href', '/');
  });

  it('loads the desktop hero chunk only after desktop viewport detection', () => {
    mockMatchMedia(true);

    render(<Hero />);

    expect(screen.getByTestId('desktop-hero-grid')).toBeInTheDocument();
  });

  it('renders the desktop LCP image in the fallback shell before viewport detection', () => {
    render(<Hero />);

    // The fallback shell is intentionally hidden from assistive technology:
    // the interactive desktop hero chunk owns the accessible carousel.
    const fallbackImage = screen.getByRole('img', {
      hidden: true,
      name: /iphone 17 pro max/i,
    });
    const picture = fallbackImage.closest('picture');
    const sources = Array.from(picture?.querySelectorAll('source') ?? []);

    expect(fallbackImage).toHaveAttribute('loading', 'eager');
    expect(fallbackImage).toHaveAttribute('fetchpriority', 'high');
    expect(picture).toBeInstanceOf(HTMLPictureElement);
    expect(sources).toHaveLength(2);
    expect(sources[0]).toHaveAttribute('type', 'image/avif');
    expect(sources[0]).toHaveAttribute('srcset');
    expect(sources[1]).toHaveAttribute('type', 'image/jpeg');
    expect(sources[1]).toHaveAttribute('srcset');
  });
});
