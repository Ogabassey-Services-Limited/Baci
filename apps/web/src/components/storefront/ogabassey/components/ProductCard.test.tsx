import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { alt, fill: _fill, priority: _priority, ...imageProps } = props;

    return <img {...imageProps} alt={String(alt ?? '')} />;
  },
}));
vi.mock('next/link', () => ({
  default: (
    props: { children: React.ReactNode; href: string } & Record<string, unknown>
  ) => {
    const { children, prefetch: _prefetch, ...anchorProps } = props;

    return <a {...anchorProps}>{children}</a>;
  },
}));
vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchantSafe: vi.fn(() => ({ merchant: { id: 'm-1', slug: 'test' } })),
}));
vi.mock('@/lib/routes', () => ({ asRoute: vi.fn((p: string) => p) }));
vi.mock('@/lib/seo-utils', () => ({
  getProductUrl: vi.fn(() => '/test/product'),
}));
vi.mock('../providers/v2-comparison-context', () => ({
  useV2Comparison: vi.fn(() => ({
    comparisonIds: new Set(),
    isInCompare: vi.fn(() => false),
    toggleComparison: vi.fn(),
  })),
}));
vi.mock('../providers/v2-saved-context', () => ({
  useV2Saved: vi.fn(() => ({
    savedIds: new Set(),
    isSaved: vi.fn(() => false),
    toggleSaved: vi.fn(),
  })),
}));

import { ProductCard } from './ProductCard';

const mockProduct = {
  id: 'p-1',
  name: 'Test Product',
  price: '₦5,000',
  image: 'https://example.com/img.jpg',
  description: 'A test product',
  category: 'electronics',
  slug: 'test-product',
  rating: 4.5,
  reviewCount: 10,
  condition: 'New' as const,
};

describe('ProductCard', () => {
  it('renders product name', () => {
    render(
      <ProductCard
        product={mockProduct}
        onAddToCart={vi.fn()}
        isAdded={false}
      />
    );
    expect(screen.getByText('Test Product')).toBeDefined();
  });

  it('renders with isAdded state', () => {
    const { container } = render(
      <ProductCard
        product={mockProduct}
        onAddToCart={vi.fn()}
        isAdded={true}
      />
    );
    expect(container).toBeDefined();
  });

  it('links SKU-matrix products to option selection instead of quick-adding', () => {
    const onAddToCart = vi.fn();

    render(
      <ProductCard
        product={
          {
            ...mockProduct,
            available_conditions: ['open_box', 'used'],
            has_variants: true,
            variant_model: 'sku_matrix',
          } as typeof mockProduct
        }
        onAddToCart={onAddToCart}
        isAdded={false}
      />
    );

    const chooseOptionsLink = screen.getByRole('link', {
      name: `Choose options for ${mockProduct.name}`,
    });

    expect(chooseOptionsLink).toHaveAttribute('href', '/test/product');
    expect(onAddToCart).not.toHaveBeenCalled();
  });
});
