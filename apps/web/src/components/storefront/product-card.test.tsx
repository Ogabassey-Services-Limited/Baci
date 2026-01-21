import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StorefrontProductCard } from './product-card';
import type { Product } from '@/lib/products';
import type { CartItem } from '@/hooks/use-cart';

// Mocks
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/components/optimized-image', () => ({
  ProductCardImage: () => <div data-testid="product-image" />,
}));

vi.mock('@/components/themed', () => ({
  ThemedCard: ({ children, className }: { children: React.ReactNode; className: string }) => (
    <div className={className} data-testid="themed-card">
      {children}
    </div>
  ),
  ThemedButton: ({
    children,
    onClick,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    [key: string]: any;
  }) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

const mockProduct: Product = {
  id: 'prod-1',
  name: 'Test Product',
  description: 'Test Description',
  price: 100,
  image: 'img.jpg',
  imageLarge: 'img.jpg',
  imageHint: 'hint',
  brand: 'Brand',
  gtin: '123',
  mpn: '123',
  slug: 'test-product',
  status: 'active',
  stock: 10,
  manage_stock: true,
  category: 'Test Category',
};

describe('StorefrontProductCard', () => {
  const defaultProps = {
    product: mockProduct,
    formatCurrency: (val: number) => `$${val}`,
    onAddToCart: vi.fn(),
    onUpdateQuantity: vi.fn(),
    onOpenQuickView: vi.fn(),
    staggerClass: 'stagger-1',
  };

  it('renders product details correctly', () => {
    render(<StorefrontProductCard {...defaultProps} />);

    expect(screen.getByText('Test Product')).toBeDefined();
    expect(screen.getByText('Test Description')).toBeDefined();
    expect(screen.getByText('$100')).toBeDefined();
    expect(screen.getByTestId('product-image')).toBeDefined();
  });

  it('calls onAddToCart when "Add to Cart" is clicked', () => {
    render(<StorefrontProductCard {...defaultProps} />);

    const addButton = screen.getByText('Add to Cart');
    fireEvent.click(addButton);

    expect(defaultProps.onAddToCart).toHaveBeenCalledWith(mockProduct);
  });

  it('shows quantity controls when cartItem is present', () => {
    const cartItem: CartItem = { ...mockProduct, quantity: 2, cartItemId: 'item-1' };
    render(<StorefrontProductCard {...defaultProps} cartItem={cartItem} />);

    expect(screen.queryByText('Add to Cart')).toBeNull();
    expect(screen.getByDisplayValue('2')).toBeDefined();
  });

  it('calls onUpdateQuantity when + or - is clicked', () => {
    const cartItem: CartItem = { ...mockProduct, quantity: 2, cartItemId: 'item-1' };
    render(<StorefrontProductCard {...defaultProps} cartItem={cartItem} />);

    const increaseButton = screen.getByLabelText(`Increase quantity of ${mockProduct.name}`);
    fireEvent.click(increaseButton);
    expect(defaultProps.onUpdateQuantity).toHaveBeenCalledWith(mockProduct.id, 3);

    const decreaseButton = screen.getByLabelText(`Decrease quantity of ${mockProduct.name}`);
    fireEvent.click(decreaseButton);
    expect(defaultProps.onUpdateQuantity).toHaveBeenCalledWith(mockProduct.id, 1);
  });

  it('calls onOpenQuickView when quick view button is clicked', () => {
    render(<StorefrontProductCard {...defaultProps} />);

    const quickViewButton = screen.getByLabelText(`Quick view ${mockProduct.name}`);
    fireEvent.click(quickViewButton);

    expect(defaultProps.onOpenQuickView).toHaveBeenCalledWith(mockProduct);
  });
});
