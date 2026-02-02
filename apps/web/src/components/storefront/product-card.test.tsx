import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Product } from '@/lib/products';
import { StorefrontProductCard } from './product-card';

// Mock dependencies
vi.mock('next/link', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/components/optimized-image', () => ({
  ProductCardImage: () => <div data-testid="product-image" />,
}));

vi.mock('@/components/themed', () => ({
  ThemedCard: ({
    children,
    className,
  }: React.PropsWithChildren<{ className?: string }>) => (
    <div className={className}>{children}</div>
  ),
  ThemedButton: ({
    children,
    onClick,
    disabled,
    'aria-label': ariaLabel,
  }: React.PropsWithChildren<{
    onClick?: () => void;
    disabled?: boolean;
    'aria-label'?: string;
  }>) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  ),
  ThemedBadge: ({
    children,
  }: React.PropsWithChildren<Record<string, unknown>>) => (
    <span>{children}</span>
  ),
}));

vi.mock('@/hooks/use-currency', () => ({
  useCurrency: () => ({
    formatCurrency: (amount: number) => `$${amount}`,
  }),
}));

vi.mock('@/lib/seo-utils', () => ({
  getProductUrl: () => '/product/test',
}));

// Basic product mock
const mockProduct: Product = {
  id: 'p1',
  name: 'Test Product',
  description: 'A test product',
  status: 'active',
  price: 100,
  manage_stock: true,
  stock: 10,
  image: 'img.jpg',
  imageLarge: 'img-large.jpg',
  imageHint: 'hint',
  brand: 'Brand',
  gtin: '123',
  mpn: 'MPN',
};

describe('StorefrontProductCard', () => {
  const mockHandler = vi.fn();

  it('renders product name and price', () => {
    render(
      <StorefrontProductCard
        product={mockProduct}
        staggerClass=""
        onAddToCart={mockHandler}
        onUpdateQuantity={mockHandler}
        onQuickView={mockHandler}
      />
    );

    expect(screen.getByText('Test Product')).toBeInTheDocument();
    expect(screen.getByText('$100')).toBeInTheDocument();
  });

  it('renders discount badge and original price when on sale', () => {
    const saleProduct = {
      ...mockProduct,
      compare_at_price: 125, // 20% off
    };

    render(
      <StorefrontProductCard
        product={saleProduct}
        staggerClass=""
        onAddToCart={mockHandler}
        onUpdateQuantity={mockHandler}
        onQuickView={mockHandler}
      />
    );

    // These assertions expect the new behavior
    expect(screen.getByText('$125')).toBeInTheDocument(); // Original price
    expect(screen.getByText('-20%')).toBeInTheDocument(); // Percentage badge

    // Accessibility checks
    expect(screen.getByText(/original price/i)).toBeInTheDocument();
    expect(screen.getByText(/current price/i)).toBeInTheDocument();
  });
});
