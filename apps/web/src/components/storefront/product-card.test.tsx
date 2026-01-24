import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StorefrontProductCard } from './product-card';

// Mock dependencies
vi.mock('@/hooks/use-currency', () => ({
  useCurrency: () => ({
    formatCurrency: (amount: number) => `$${amount}`,
  }),
}));

vi.mock('@/components/optimized-image', () => ({
  ProductCardImage: (props: any) => <div data-testid="product-image" {...props} />,
}));

vi.mock('@/components/themed', () => ({
  ThemedCard: ({ children, className }: any) => <div className={className} data-testid="themed-card">{children}</div>,
  ThemedButton: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock('@/lib/seo-utils', () => ({
  getProductUrl: () => '/product/test',
}));

// Mock Product
const mockProduct: any = {
  id: 'test-id',
  name: 'Test Product',
  description: 'Test Description',
  price: 100,
  compare_at_price: 120,
  stock: 10,
  manage_stock: true,
  imageLarge: 'test.jpg',
  imageHint: 'test hint',
  categories: { name: 'Test Category' },
  category: 'Test Category',
  slug: 'test-product',
  merchant_id: 'merchant-1',
  created_at: '2023-01-01',
  updated_at: '2023-01-01',
  images: [],
  is_digital: false,
  rating: 5,
  review_count: 10,
};

describe('StorefrontProductCard', () => {
  it('renders quick view button but it is hidden initially', () => {
    render(
      <StorefrontProductCard
        product={mockProduct}
        staggerClass=""
        onAddToCart={vi.fn()}
        onUpdateQuantity={vi.fn()}
        onQuickView={vi.fn()}
      />
    );

    const quickViewBtn = screen.getByRole('button', { name: /quick view test product/i });
    expect(quickViewBtn).toBeInTheDocument();

    // Check classes - it should have focus-visible classes now
    expect(quickViewBtn).toHaveClass('opacity-0');
    expect(quickViewBtn).toHaveClass('focus-visible:opacity-100');
    expect(quickViewBtn).toHaveClass('focus-visible:ring-2');
  });
});
