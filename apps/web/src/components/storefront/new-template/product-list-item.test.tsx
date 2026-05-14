import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchantSafe: () => ({ basePath: '/ogabassey' }),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...rest
  }: { children: React.ReactNode; href: string } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => (
    <img {...props} alt={String(props.alt ?? '')} />
  ),
}));

import { ProductListItem } from './product-list-item';

const baseProduct = {
  id: 'product-1',
  name: 'iPhone 15 Pro',
  price: '₦1,200,000',
  image: '/iphone.jpg',
  category: 'smartphones',
  slug: 'iphone-15-pro',
  categories: { slug: 'smartphones' },
  rating: 4.8,
  reviews: 12,
  description: 'Flagship phone',
  condition: 'Open Box',
};

describe('ProductListItem', () => {
  it('links to the canonical storefront product route', () => {
    render(
      <ProductListItem
        product={baseProduct}
        onAddToCart={vi.fn()}
        isAdded={false}
        isWishlisted={false}
        onToggleWishlist={vi.fn()}
      />
    );

    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/ogabassey/smartphones/iphone-15-pro'
    );
  });

  it('uses store theme variables for the condition badge', () => {
    render(
      <ProductListItem
        product={baseProduct}
        onAddToCart={vi.fn()}
        isAdded={false}
        isWishlisted={false}
        onToggleWishlist={vi.fn()}
      />
    );

    expect(screen.getByText('Open Box')).toHaveAttribute(
      'style',
      expect.stringContaining('var(--store-primary)')
    );
  });

  it('renders every interactive icon button with type="button" so the card never accidentally submits a parent form', () => {
    const productWithColors = {
      ...baseProduct,
      colors: [
        { name: 'Black', value: '#000000' },
        { name: 'Silver', value: '#cccccc' },
      ],
    };

    render(
      <ProductListItem
        product={productWithColors}
        onAddToCart={vi.fn()}
        isAdded={false}
        isWishlisted={false}
        onToggleWishlist={vi.fn()}
      />
    );

    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveAttribute('type', 'button');
    }
  });
});
