import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';

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
          ([key]) => key !== 'fill' && key !== 'priority' && key !== 'unoptimized'
        )
      )}
      alt={String(props.alt ?? '')}
      data-unoptimized={String(Boolean(props.unoptimized))}
    />
  ),
  getImageProps: ({
    src,
    sizes,
    alt,
    loading,
    fetchPriority,
    decoding,
    width,
    height,
  }: Record<string, unknown>) => ({
    props: { src, srcSet: src, sizes, alt, loading, fetchPriority, decoding, width, height },
  }),
}));

import { HeroDesktopGrid } from './hero-desktop-grid';
import type { LaunchProductSlide } from './LaunchCarousel';

function makeSlide(
  overrides: Partial<LaunchProductSlide> & Pick<LaunchProductSlide, 'id'>
): LaunchProductSlide {
  return {
    kind: 'product',
    name: `Product ${overrides.id}`,
    priceLabel: '₦100,000',
    href: `/ogabassey/smartphones/product-${overrides.id}`,
    imageUrl: `https://cdn.ogabassey.com/products/product-${overrides.id}.avif`,
    imageAlt: `Product ${overrides.id} image`,
    ctaLabel: 'Shop now',
    ...overrides,
  };
}

const SLIDES: LaunchProductSlide[] = [
  makeSlide({
    id: '1',
    name: 'Samsung Galaxy A27 5G',
    priceLabel: '₦50,000',
    href: '/ogabassey/smartphones/samsung-galaxy-a27-5g',
    ctaLabel: 'Pre-order now',
  }),
  makeSlide({
    id: '2',
    name: 'Itel Power 80',
    href: '/ogabassey/smartphones/itel-power-80-128gb-4gb',
  }),
  makeSlide({ id: '3', name: 'Itel IT2160' }),
  makeSlide({ id: '4', name: 'Should Not Render' }),
];

describe('HeroDesktopGrid', () => {
  it('renders the first launch product as the big hero with its price, CTA and PDP deep-link', () => {
    render(<HeroDesktopGrid slides={SLIDES} />);

    expect(
      screen.getByRole('heading', { name: 'Samsung Galaxy A27 5G' })
    ).toBeInTheDocument();
    expect(screen.getByText('₦50,000')).toBeInTheDocument();

    const bigLink = screen.getByRole('link', {
      name: 'Samsung Galaxy A27 5G — Pre-order now',
    });
    expect(bigLink).toHaveAttribute(
      'href',
      '/ogabassey/smartphones/samsung-galaxy-a27-5g'
    );
    expect(bigLink).toHaveAttribute('data-prefetch', 'false');
  });

  it('serves the big hero image as a desktop-scoped eager LCP picture', () => {
    const { container } = render(<HeroDesktopGrid slides={SLIDES} />);

    const source = container.querySelector(
      'picture source[media="(min-width: 768px)"]'
    );
    expect(source).toHaveAttribute(
      'srcset',
      'https://cdn.ogabassey.com/products/product-1.avif'
    );

    const img = container.querySelector('picture img');
    expect(img).toHaveAttribute('loading', 'eager');
    expect(img).toHaveAttribute('fetchpriority', 'high');
  });

  it('renders exactly two side cards from the next launch products, deep-linked', () => {
    render(<HeroDesktopGrid slides={SLIDES} />);

    const powerLink = screen.getByRole('link', {
      name: 'Itel Power 80 — Shop now',
    });
    expect(powerLink).toHaveAttribute(
      'href',
      '/ogabassey/smartphones/itel-power-80-128gb-4gb'
    );

    expect(
      screen.getByRole('heading', { name: 'Itel IT2160' })
    ).toBeInTheDocument();
    // 4th slide must not render (big + 2 side cards only).
    expect(
      screen.queryByRole('heading', { name: 'Should Not Render' })
    ).not.toBeInTheDocument();
  });

  it('renders nothing when there are no launch products', () => {
    const { container } = render(<HeroDesktopGrid slides={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
