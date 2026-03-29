import type { Product } from '@/lib/products';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@baci/shared', () => ({
  prioritizeSmartphoneProducts: vi.fn((products: unknown[]) => products),
}));
vi.mock('@/hooks/use-merchant', () => ({
  useMerchantSafe: vi.fn(() => ({
    merchant: { id: 'm-1', slug: 'test-store', business_name: 'Test Store' },
  })),
}));
vi.mock('../components/Hero', () => ({
  Hero: () => <div data-testid="hero">Hero</div>,
}));
vi.mock('../components/BannerCarousel', () => ({
  BannerCarousel: () => <div data-testid="banner-carousel">Banner</div>,
}));

const mockEngineProductGrid = vi.fn(
  (props: {
    title: string;
    storeSlug?: string;
    externalProducts?: unknown[];
    categories?: unknown[];
    useMockData?: boolean;
  }) => (
    <div data-testid="product-grid">
      {props.title}
    </div>
  )
);
vi.mock('../components/EngineProductGrid', () => ({
  EngineProductGrid: (props: Record<string, unknown>) => mockEngineProductGrid(props as Parameters<typeof mockEngineProductGrid>[0]),
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

  it('passes products and categories to EngineProductGrid', () => {
    const testProducts: Product[] = [
      {
        id: 'p-1',
        name: 'Phone',
        description: 'A smartphone',
        status: 'active',
        price: 100000,
        manage_stock: true,
        stock: 10,
        image: '/phone.jpg',
        imageLarge: '/phone-lg.jpg',
        imageHint: 'Phone',
        brand: 'TestBrand',
        gtin: '',
        mpn: '',
      },
    ];
    const testCategories = [{ name: 'Electronics', slug: 'electronics' }];

    render(
      <OgabasseyHomePage
        products={testProducts}
        categories={testCategories}
      />
    );

    expect(screen.getByText('Featured Products')).toBeInTheDocument();
    expect(mockEngineProductGrid).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Featured Products',
        storeSlug: 'test-store',
        externalProducts: testProducts,
        categories: testCategories,
      })
    );
  });

  it('renders the banner carousel for desktop', () => {
    render(<OgabasseyHomePage products={[]} categories={[]} />);

    expect(screen.getByTestId('banner-carousel')).toBeInTheDocument();
  });
});
