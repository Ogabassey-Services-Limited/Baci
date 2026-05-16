import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '@/lib/products';
import { StorefrontProductCard } from './product-card';

// Mock dependencies
vi.mock('next/link', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/components/optimized-image', () => ({
  ProductCardImage: () => <div data-testid="product-image" />,
}));

interface MockCardProps {
  children: React.ReactNode;
  className?: string;
}

interface MockButtonProps {
  children: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  'aria-label'?: string;
}

interface MockBadgeProps {
  children: React.ReactNode;
}

vi.mock('@/components/themed', () => ({
  ThemedCard: ({ children, className }: MockCardProps) => (
    <div className={className}>{children}</div>
  ),
  ThemedButton: ({
    children,
    onClick,
    disabled,
    'aria-label': ariaLabel,
  }: MockButtonProps) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  ),
  ThemedBadge: ({ children }: MockBadgeProps) => <span>{children}</span>,
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
  const mockAddToCart = vi.fn();
  const mockUpdateQuantity = vi.fn();
  const mockQuickView = vi.fn();

  beforeEach(() => {
    mockAddToCart.mockReset();
    mockUpdateQuantity.mockReset();
    mockQuickView.mockReset();
  });

  it('renders product name and price', () => {
    render(
      <StorefrontProductCard
        product={mockProduct}
        staggerClass=""
        onAddToCart={mockAddToCart}
        onUpdateQuantity={mockUpdateQuantity}
        onQuickView={mockQuickView}
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
        onAddToCart={mockAddToCart}
        onUpdateQuantity={mockUpdateQuantity}
        onQuickView={mockQuickView}
      />
    );

    // These assertions expect the new behavior
    expect(screen.getByText('$125')).toBeInTheDocument(); // Original price
    expect(screen.getByText('-20%')).toBeInTheDocument(); // Percentage badge

    // Accessibility checks
    expect(screen.getByText(/original price/i)).toBeInTheDocument();
    expect(screen.getByText(/current price/i)).toBeInTheDocument();
  });

  it('does not render discount badge when compare_at_price equals price', () => {
    const noDiscountProduct = {
      ...mockProduct,
      compare_at_price: 100, // Same as price
    };

    render(
      <StorefrontProductCard
        product={noDiscountProduct}
        staggerClass=""
        onAddToCart={mockAddToCart}
        onUpdateQuantity={mockUpdateQuantity}
        onQuickView={mockQuickView}
      />
    );

    expect(screen.getByText('$100')).toBeInTheDocument();
    expect(screen.queryByText(/-\d+%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/original price/i)).not.toBeInTheDocument();
  });

  it('does not render discount badge when discount rounds to 0%', () => {
    const tinyDiscountProduct = {
      ...mockProduct,
      price: 9999,
      compare_at_price: 10000, // 0.01% off — rounds to 0
    };

    render(
      <StorefrontProductCard
        product={tinyDiscountProduct}
        staggerClass=""
        onAddToCart={mockAddToCart}
        onUpdateQuantity={mockUpdateQuantity}
        onQuickView={mockQuickView}
      />
    );

    expect(screen.queryByText(/-\d+%/)).not.toBeInTheDocument();
    expect(screen.getByText('$9999')).toBeInTheDocument();
  });

  it('shows out-of-stock state and disables add-to-cart when stock is 0', () => {
    const outOfStockProduct = {
      ...mockProduct,
      stock: 0,
      manage_stock: true,
    };

    render(
      <StorefrontProductCard
        product={outOfStockProduct}
        staggerClass=""
        onAddToCart={mockAddToCart}
        onUpdateQuantity={mockUpdateQuantity}
        onQuickView={mockQuickView}
      />
    );

    const addButton = screen.getByRole('button', { name: /out of stock/i });
    expect(addButton).toBeDisabled();
  });

  it('shows low-stock indicator at threshold', () => {
    const lowStockProduct = {
      ...mockProduct,
      stock: 3,
      manage_stock: true,
      low_stock_threshold: 5,
    };

    render(
      <StorefrontProductCard
        product={lowStockProduct}
        staggerClass=""
        onAddToCart={mockAddToCart}
        onUpdateQuantity={mockUpdateQuantity}
        onQuickView={mockQuickView}
      />
    );

    expect(screen.getByText(/low stock/i)).toBeInTheDocument();
  });
});
