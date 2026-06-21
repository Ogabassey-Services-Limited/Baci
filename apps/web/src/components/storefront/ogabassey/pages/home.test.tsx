import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../types';

const mockHomeProductGrid = vi.hoisted(() =>
  vi.fn(
    (props: {
      storeSlug?: string;
      products?: unknown[];
      initialDisplayCount?: number;
      inlineAdBreakpoints?: number[];
    }) => <div data-testid="product-grid">{String(props.storeSlug)}</div>
  )
);
const mockDeferredAdUnit = vi.hoisted(() =>
  vi.fn((props: Record<string, unknown>) => (
    <div data-testid="ad-unit">
      <span>{String(props.placementKey ?? 'Ad')}</span>
      {props.fallback as ReactNode}
    </div>
  ))
);
const mockLaunchCarousel = vi.hoisted(() =>
  vi.fn((props: { slides?: Array<{ href?: string; ctaLabel?: string }> }) => (
    <div data-testid="launch-carousel">{props.slides?.length ?? 0}</div>
  ))
);
const mockHero = vi.hoisted(() =>
  vi.fn((props: { basePath?: string }) => (
    <div data-testid="hero">{props.basePath}</div>
  ))
);

vi.mock('@baci/shared', () => ({
  prioritizeSmartphoneProducts: vi.fn((products: unknown[]) => products),
}));
vi.mock('../components/Hero', () => ({
  Hero: (props: { basePath?: string }) => mockHero(props),
}));
vi.mock('../components/HomeProductGrid', () => ({
  HomeProductGrid: (props: Record<string, unknown>) =>
    mockHomeProductGrid(props as Parameters<typeof mockHomeProductGrid>[0]),
}));
vi.mock('../components/deferred-ad-unit', () => ({
  DeferredAdUnit: (props: Record<string, unknown>) => mockDeferredAdUnit(props),
}));
vi.mock('../components/LaunchCarousel', () => ({
  LaunchCarousel: (props: Record<string, unknown>) =>
    mockLaunchCarousel(props as Parameters<typeof mockLaunchCarousel>[0]),
}));

import { OgabasseyHomePage } from './home';

const launchProduct = (overrides: Partial<Product>): Product => ({
  id: 'a27',
  name: 'Samsung Galaxy A27 5G Preorder',
  description: '',
  price: '₦50,000',
  image: 'https://cdn.ogabassey.com/core-assets/products/a27.avif',
  slug: 'samsung-galaxy-a27-5g',
  brand: 'Samsung',
  category: 'Smartphones',
  categorySlug: 'smartphones',
  categories: { id: 'c1', name: 'Smartphones', slug: 'smartphones' },
  ...overrides,
});

describe('OgabasseyHomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders core sections: hero, ad unit, and product grid', () => {
    render(<OgabasseyHomePage products={[]} categories={[]} />);

    expect(screen.getByTestId('hero')).toBeInTheDocument();
    expect(screen.getByTestId('ad-unit')).toBeInTheDocument();
    expect(screen.getByTestId('product-grid')).toBeInTheDocument();
  });

  it('can omit the hero when the route shell renders it outside dynamic content', () => {
    render(
      <OgabasseyHomePage products={[]} categories={[]} renderHero={false} />
    );

    expect(screen.queryByTestId('hero')).not.toBeInTheDocument();
    expect(screen.getByTestId('ad-unit')).toBeInTheDocument();
    expect(screen.getByTestId('product-grid')).toBeInTheDocument();
  });

  it('derives a slug route base path for the hero', () => {
    render(
      <OgabasseyHomePage storeSlug="test-store" products={[]} categories={[]} />
    );

    expect(mockHero).toHaveBeenCalledWith(
      expect.objectContaining({ basePath: '/test-store' })
    );
  });

  it('preserves an explicit empty base path for custom-domain hero links', () => {
    render(
      <OgabasseyHomePage
        basePath=""
        storeSlug="test-store"
        products={[]}
        categories={[]}
      />
    );

    expect(mockHero).toHaveBeenCalledWith(
      expect.objectContaining({ basePath: '' })
    );
  });

  it('passes products to the home product grid', () => {
    const testProducts: Product[] = [
      {
        id: 'p-1',
        name: 'Phone',
        description: 'A smartphone',
        price: '₦100,000',
        rawPrice: 100000,
        condition: 'New',
        image: '/phone.jpg',
        brand: 'TestBrand',
        categories: {
          id: 'cat-1',
          name: 'Electronics',
          slug: 'electronics',
        },
      },
    ];
    const testCategories = [{ name: 'Electronics', slug: 'electronics' }];

    render(
      <OgabasseyHomePage
        storeSlug="test-store"
        products={testProducts}
        categories={testCategories}
      />
    );

    expect(mockHomeProductGrid).toHaveBeenCalledWith(
      expect.objectContaining({
        storeSlug: 'test-store',
        products: testProducts,
        initialDisplayCount: 8,
        inlineAdBreakpoints: [12, 24],
      })
    );
  });

  it('renders the launch carousel with basePath-joined product deep-links', () => {
    render(
      <OgabasseyHomePage
        storeSlug="test-store"
        products={[]}
        launchProducts={[launchProduct({})]}
        categories={[]}
      />
    );

    expect(screen.getByTestId('launch-carousel')).toBeInTheDocument();
    const slides = mockLaunchCarousel.mock.calls.at(-1)?.[0]?.slides ?? [];
    expect(slides).toHaveLength(1);
    expect(slides[0].href?.startsWith('/test-store/')).toBe(true);
    expect(slides[0].href).toContain('samsung-galaxy-a27-5g');
    expect(slides[0].ctaLabel).toBe('Pre-order now');
  });

  it('hides the launch carousel when there are no launch products', () => {
    render(<OgabasseyHomePage products={[]} categories={[]} />);

    expect(screen.queryByTestId('launch-carousel')).not.toBeInTheDocument();
  });

  it('keeps the homepage strip ad out of the no-interaction main-thread window', () => {
    render(<OgabasseyHomePage products={[]} categories={[]} />);

    expect(mockDeferredAdUnit).toHaveBeenCalledWith(
      expect.objectContaining({
        placementKey: 'HOMEPAGE_STRIP',
        bootDelayMs: expect.any(Number),
      })
    );

    const homepageStripCall = mockDeferredAdUnit.mock.calls.find(
      ([props]) =>
        (props as { placementKey?: string }).placementKey === 'HOMEPAGE_STRIP'
    );

    expect(homepageStripCall).toBeDefined();
    expect(
      (homepageStripCall?.[0] as { bootDelayMs?: number }).bootDelayMs
    ).toBeGreaterThanOrEqual(9000);
    expect(homepageStripCall?.[0]).toEqual(
      expect.objectContaining({
        activateOnInteraction: true,
        timeoutMs: 0,
      })
    );
    expect(
      (homepageStripCall?.[0] as { fallback?: unknown }).fallback
    ).toBeUndefined();
  });
});
