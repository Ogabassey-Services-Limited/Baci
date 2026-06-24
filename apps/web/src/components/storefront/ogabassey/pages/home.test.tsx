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
    }) => (
      <div data-testid="product-grid">
        {String(props.storeSlug)}
      </div>
    )
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
const mockDeferredBannerCarousel = vi.hoisted(() =>
  vi.fn((props: Record<string, unknown>) => (
    <div data-testid="banner-carousel">{String(props.className ?? '')}</div>
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

  it('can omit the hero when the route shell renders it outside dynamic content', () => {
    render(
      <OgabasseyHomePage
        products={[]}
        categories={[]}
        renderHero={false}
      />
    );

    expect(screen.queryByTestId('hero')).not.toBeInTheDocument();
    expect(screen.getByTestId('ad-unit')).toBeInTheDocument();
    expect(screen.getByTestId('product-grid')).toBeInTheDocument();
  });

  it('derives a slug route base path for path-routed hero and banner links', () => {
    render(
      <OgabasseyHomePage
        storeSlug="test-store"
        products={[]}
        categories={[]}
      />
    );

    expect(mockHero).toHaveBeenCalledWith(
      expect.objectContaining({ basePath: '/test-store' })
    );
    expect(mockDeferredBannerCarousel).toHaveBeenCalledWith(
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
    expect(mockDeferredBannerCarousel).toHaveBeenCalledWith(
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

  it('keeps the homepage strip ad out of the no-interaction main-thread window', () => {
    const { container } = render(
      <OgabasseyHomePage products={[]} categories={[]} />
    );

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

    // Keep GAM boot out of no-interaction lab runs. The reserved fallback
    // protects CLS, while pointer/keyboard intent still allows ads to hydrate
    // for real shoppers after they engage with the page.
    expect(
      (homepageStripCall?.[0] as { bootDelayMs?: number }).bootDelayMs
    ).toBeGreaterThanOrEqual(9000);

    expect(homepageStripCall?.[0]).toEqual(
      expect.objectContaining({
        activateOnInteraction: true,
        timeoutMs: 0,
      })
    );

    // CLS protection for the strip is now delegated to DeferredAdUnit's default
    // AdSlotShell, which reserves a box height-locked to the exact creative size
    // (mobile 50px / desktop 90px) instead of a hand-rolled min-height fallback.
    // So the strip passes no custom fallback.
    expect(
      (homepageStripCall?.[0] as { fallback?: unknown }).fallback
    ).toBeUndefined();
  });
});
