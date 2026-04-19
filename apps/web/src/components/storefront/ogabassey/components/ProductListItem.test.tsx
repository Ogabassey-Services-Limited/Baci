import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Product } from '../types';
import { ProductListItem } from './ProductListItem';

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

const baseProduct: Product = {
  id: 'product-1',
  name: 'MacBook Pro',
  price: '₦3,450,000',
  image: '/macbook.jpg',
  category: 'Laptops',
  slug: 'macbook-pro',
  categories: {
    id: 'cat-laptops',
    name: 'Laptops',
    slug: 'laptops',
  },
  rating: 4.7,
  description: 'Powerful laptop for creative work.',
  condition: 'New',
  images: ['/macbook-silver.jpg', '/macbook-space-black.jpg'],
  colors: [
    { name: 'Silver', value: '#d1d5db' },
    { name: 'Space Black', value: '#1f2937' },
  ],
};

describe('ProductListItem', () => {
  it('uses the provided basePath for navigation and actions', () => {
    const onAddToCart = vi.fn();
    const onToggleWishlist = vi.fn();

    render(
      <ProductListItem
        basePath="/ogabassey"
        product={baseProduct}
        onAddToCart={onAddToCart}
        isAdded={false}
        isWishlisted={false}
        onToggleWishlist={onToggleWishlist}
      />
    );

    expect(
      screen.getByRole('link', {
        name: `${baseProduct.name} - ${baseProduct.price}`,
      })
    ).toHaveAttribute('href', '/ogabassey/laptops/macbook-pro');

    fireEvent.click(screen.getByRole('button', { name: 'Add to wishlist' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous color' }));
    fireEvent.click(
      screen.getByRole('button', { name: /Add to Cart/i })
    );

    expect(onToggleWishlist).toHaveBeenCalledOnce();
    expect(onAddToCart).toHaveBeenCalledWith(expect.any(Object), baseProduct);
  });
});
