import { render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '@/lib/products';
import { StorefrontProductCard } from './product-card';

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/optimized-image', () => ({
  ProductCardImage: ({ alt }: { alt: string }) => (
    <div data-testid="product-image" role="img" aria-label={alt} />
  ),
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

describe('StorefrontProductCard accessibility', () => {
  const mockAddToCart = vi.fn();
  const mockUpdateQuantity = vi.fn();
  const mockQuickView = vi.fn();

  beforeEach(() => {
    mockAddToCart.mockReset();
    mockUpdateQuantity.mockReset();
    mockQuickView.mockReset();
  });

  it('uses the rendered image alt text when product images include one', () => {
    render(
      <StorefrontProductCard
        product={{
          ...mockProduct,
          images: [
            {
              url: 'img-large.jpg',
              alt: 'Brand product angled view',
              order: 0,
            },
          ],
        }}
        staggerClass=""
        onAddToCart={mockAddToCart}
        onUpdateQuantity={mockUpdateQuantity}
        onQuickView={mockQuickView}
      />
    );

    expect(
      screen.getByRole('img', {
        name: 'Brand product angled view',
      })
    ).toBeInTheDocument();
  });

  it('keeps the product image link named by the product', () => {
    render(
      <StorefrontProductCard
        product={{
          ...mockProduct,
          images: [
            {
              url: 'img-large.jpg',
              alt: 'Front view on white background',
              order: 0,
            },
          ],
        }}
        staggerClass=""
        onAddToCart={mockAddToCart}
        onUpdateQuantity={mockUpdateQuantity}
        onQuickView={mockQuickView}
      />
    );

    expect(
      screen.getByRole('link', {
        name: mockProduct.name,
      })
    ).toHaveAttribute('href', '/product/test');
    expect(
      screen.getByRole('img', {
        name: 'Front view on white background',
      })
    ).toBeInTheDocument();
  });

  it('matches image alt text to the rendered image URL', () => {
    render(
      <StorefrontProductCard
        product={{
          ...mockProduct,
          image: 'fallback.jpg',
          imageLarge: 'img-large.jpg',
          images: [
            {
              url: '',
              alt: 'Do not use this alt',
              order: 0,
            },
            {
              url: 'img-large.jpg',
              alt: 'Rendered large product image',
              order: 1,
            },
          ],
        }}
        staggerClass=""
        onAddToCart={mockAddToCart}
        onUpdateQuantity={mockUpdateQuantity}
        onQuickView={mockQuickView}
      />
    );

    expect(
      screen.getByRole('img', {
        name: 'Rendered large product image',
      })
    ).toBeInTheDocument();
  });

  it('falls back to the product name when primary image alt text is missing', () => {
    render(
      <StorefrontProductCard
        product={{
          ...mockProduct,
          images: [
            {
              url: 'img-large.jpg',
              alt: '',
              order: 0,
            },
          ],
        }}
        staggerClass=""
        onAddToCart={mockAddToCart}
        onUpdateQuantity={mockUpdateQuantity}
        onQuickView={mockQuickView}
      />
    );

    expect(
      screen.getByRole('img', {
        name: mockProduct.name,
      })
    ).toBeInTheDocument();
  });

  it('falls back to the product name when primary image alt is whitespace-only', () => {
    render(
      <StorefrontProductCard
        product={{
          ...mockProduct,
          images: [
            {
              url: 'img-large.jpg',
              alt: '   ',
              order: 0,
            },
          ],
        }}
        staggerClass=""
        onAddToCart={mockAddToCart}
        onUpdateQuantity={mockUpdateQuantity}
        onQuickView={mockQuickView}
      />
    );

    expect(
      screen.getByRole('img', {
        name: mockProduct.name,
      })
    ).toBeInTheDocument();
  });
});
