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

vi.mock('@baci/shared', () => ({
  prioritizeSmartphoneProducts: vi.fn((products: unknown[]) => products),
}));
vi.mock('../components/Hero', () => ({
  Hero: () => <div data-testid="hero">Hero</div>,
}));
vi.mock('../components/BannerCarousel', () => ({
  BannerCarousel: () => <div data-testid="banner-carousel">Banner</div>,
}));
vi.mock('../components/deferred-shell-feature', () => ({
  DeferredShellFeature: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('../components/HomeProductGrid', () => ({
  HomeProductGrid: (props: Record<string, unknown>) =>
    mockHomeProductGrid(props as Parameters<typeof mockHomeProductGrid>[0]),
}));
vi.mock('../components/AdUnit', () => ({
  AdUnit: () => <div data-testid="ad-unit">Ad</div>,
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
  });
});
