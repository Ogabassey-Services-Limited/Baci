import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../types';

const mockHomeProductGrid = vi.hoisted(() =>
  vi.fn(
    (props: {
      storeSlug?: string;
      products?: unknown[];
      initialDisplayCount?: number;
      inlineAdBreakpoints?: number[];
    }) => (
      <div data-testid="product-grid">
        {String(props.storeSlug)}
      </div>
    )
  )
);
const mockDeferredAdUnit = vi.hoisted(() =>
  vi.fn((props: Record<string, unknown>) => (
    <div data-testid="ad-unit">{String(props.placementKey ?? 'Ad')}</div>
  ))
);
const mockDeferredBannerCarousel = vi.hoisted(() =>
  vi.fn((props: Record<string, unknown>) => (
    <div data-testid="banner-carousel">{String(props.className ?? '')}</div>
  ))
);

vi.mock('@baci/shared', () => ({
  prioritizeSmartphoneProducts: vi.fn((products: unknown[]) => products),
}));
vi.mock('../components/Hero', () => ({
  Hero: () => <div data-testid="hero">Hero</div>,
}));
vi.mock('../components/HomeProductGrid', () => ({
  HomeProductGrid: (props: Record<string, unknown>) =>
    mockHomeProductGrid(props as Parameters<typeof mockHomeProductGrid>[0]),
}));
vi.mock('../components/deferred-ad-unit', () => ({
  DeferredAdUnit: (props: Record<string, unknown>) =>
    mockDeferredAdUnit(props),
}));
vi.mock('../components/deferred-banner-carousel', () => ({
  DeferredBannerCarousel: (props: Record<string, unknown>) =>
    mockDeferredBannerCarousel(props),
}));

import { OgabasseyHomePage } from './home';

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

  it('renders the banner carousel for desktop', () => {
    render(<OgabasseyHomePage products={[]} categories={[]} />);

    expect(screen.getByTestId('banner-carousel')).toBeInTheDocument();
    expect(mockDeferredBannerCarousel).toHaveBeenCalledWith(
      expect.objectContaining({
        className: 'h-40 md:h-52',
        timeoutMs: expect.any(Number),
      })
    );
  });

  it('keeps the homepage strip ad out of the early main-thread window', () => {
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

    // Keep GAM boot outside the 0-9s PageSpeed long-task capture window seen
    // in the 2026-05-05 desktop PSI run for ogabassey.com.
    expect(
      (homepageStripCall?.[0] as { bootDelayMs?: number }).bootDelayMs
    ).toBeGreaterThanOrEqual(9000);

    expect(homepageStripCall?.[0]).toEqual(
      expect.objectContaining({ timeoutMs: 1 })
    );
  });
});
