import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
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

vi.mock('@/components/themed', () => ({
  ThemedCard: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
  ThemedButton: ({
    children,
    disabled,
    onClick,
    'aria-label': ariaLabel,
  }: {
    children: React.ReactNode;
    disabled?: boolean;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    'aria-label'?: string;
  }) => (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {children}
    </button>
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

describe('StorefrontProductCard runtime fallbacks', () => {
  it('safely falls back when image payload fields are nullish at runtime', () => {
    render(
      <StorefrontProductCard
        product={
          {
            ...mockProduct,
            image: null,
            imageLarge: null,
            name: null,
            images: [
              {
                url: null,
                alt: null,
                order: 0,
              },
            ],
          } as unknown as Product
        }
        staggerClass=""
        onAddToCart={vi.fn()}
        onUpdateQuantity={vi.fn()}
        onQuickView={vi.fn()}
      />
    );

    expect(
      screen.getByRole('img', {
        name: 'Product image',
      })
    ).toBeInTheDocument();
  });
});
