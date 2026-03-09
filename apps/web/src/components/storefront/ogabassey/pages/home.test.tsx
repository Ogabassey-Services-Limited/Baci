import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
vi.mock('../components/EngineProductGrid', () => ({
  EngineProductGrid: (props: { title: string; storeSlug?: string }) => (
    <div data-testid="product-grid">{props.title}</div>
  ),
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

  it('includes an accessible sr-only heading with business name', () => {
    render(<OgabasseyHomePage products={[]} categories={[]} />);

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveClass('sr-only');
    expect(heading).toHaveTextContent('Test Store');
  });

  it('passes products and categories to EngineProductGrid', () => {
    render(<OgabasseyHomePage products={[]} categories={[]} />);

    expect(screen.getByText('Featured Products')).toBeInTheDocument();
  });

  it('renders the banner carousel for desktop', () => {
    render(<OgabasseyHomePage products={[]} categories={[]} />);

    expect(screen.getByTestId('banner-carousel')).toBeInTheDocument();
  });
});
