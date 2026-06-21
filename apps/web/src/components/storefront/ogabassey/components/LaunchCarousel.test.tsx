import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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

import { LaunchCarousel, type LaunchSlide } from './LaunchCarousel';

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

describe('LaunchCarousel', () => {
  it('renders every launch product as a crawlable deep-link with price + CTA in the SSR markup', () => {
    const { container } = render(<LaunchCarousel slides={PRODUCT_SLIDES} />);

    // All product links are present in the DOM (not deferred/hidden from crawlers),
    // even though only one slide is visually active.
    const links = Array.from(container.querySelectorAll('a[href]'));
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/ogabassey/smartphones/samsung-galaxy-a27-5g',
      '/ogabassey/smartphones/itel-power-80-128gb-4gb',
    ]);

    expect(screen.getByText('Samsung Galaxy A27 5G Preorder')).toBeDefined();
    expect(screen.getByText('₦50,000')).toBeDefined();
    expect(screen.getByText('Pre-order now')).toBeDefined();
    expect(screen.getByText('Itel Power 80')).toBeDefined();
    expect(screen.getByText('Shop now')).toBeDefined();
  });

  it('gives each product image descriptive alt and lazy/low-priority loading (no LCP steal)', () => {
    const { container } = render(<LaunchCarousel slides={PRODUCT_SLIDES} />);

    const images = Array.from(container.querySelectorAll('img'));
    expect(images).toHaveLength(2);
    expect(images[0].getAttribute('alt')).toBe('Samsung Galaxy A27 5G — Samsung');
    for (const img of images) {
      expect(img.getAttribute('loading')).toBe('lazy');
      expect(img.getAttribute('fetchpriority')).toBe('low');
    }
  });

  it('renders a CSS-only promo slide with no image', () => {
    const promo: LaunchSlide[] = [
      {
        kind: 'promo',
        id: 'sale',
        title: 'Flash Sale',
        subtitle: 'Up to 50% off',
        href: '/ogabassey/products',
        ctaLabel: 'Shop the sale',
      },
    ];

    const { container } = render(<LaunchCarousel slides={promo} />);

    expect(container.querySelectorAll('img')).toHaveLength(0);
    expect(screen.getByText('Flash Sale')).toBeDefined();
    expect(screen.getByText('Shop the sale')).toBeDefined();
  });

  it('renders nothing when there are no slides', () => {
    const { container } = render(<LaunchCarousel slides={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('exposes a labelled carousel region and supports arrow-key navigation', () => {
    const { container } = render(<LaunchCarousel slides={PRODUCT_SLIDES} />);

    const region = screen.getByRole('region', {
      name: 'Just launched products',
    });

    const visibleIndex = () =>
      Array.from(
        container.querySelectorAll('[aria-roledescription="slide"]')
      ).findIndex((slide) => slide.getAttribute('aria-hidden') === 'false');

    expect(visibleIndex()).toBe(0);
    fireEvent.keyDown(region, { key: 'ArrowRight' });
    expect(visibleIndex()).toBe(1);
    fireEvent.keyDown(region, { key: 'ArrowLeft' });
    expect(visibleIndex()).toBe(0);
  });

  it('shows navigation dots only when there is more than one slide', () => {
    const { rerender } = render(<LaunchCarousel slides={PRODUCT_SLIDES} />);
    expect(screen.getAllByRole('button', { name: /Go to slide/ })).toHaveLength(
      2
    );

    rerender(<LaunchCarousel slides={[PRODUCT_SLIDES[0]]} />);
    expect(screen.queryAllByRole('button', { name: /Go to slide/ })).toHaveLength(
      0
    );
  });
});
