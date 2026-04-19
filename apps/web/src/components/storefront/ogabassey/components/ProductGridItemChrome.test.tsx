import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Product } from '../types';
import {
  ProductGridContentChrome,
  ProductGridImageChrome,
} from './ProductGridItemChrome';

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

const baseProduct: Product = {
  id: 'product-1',
  name: 'PlayStation 5',
  price: '₦1,250,000',
  image: '/ps5.jpg',
  category: 'Gaming',
  slug: 'playstation-5',
  categories: {
    id: 'cat-gaming',
    name: 'Gaming',
    slug: 'gaming',
  },
  rating: 4.8,
  description: 'Console bundle with extra controller.',
  condition: 'New',
  images: ['/ps5-black.jpg', '/ps5-white.jpg'],
  colors: [
    { name: 'Black', value: '#111111' },
    { name: 'White', value: '#f5f5f5' },
  ],
  variant_attributes: {
    Platform: ['PlayStation 5', 'Nintendo Switch', 'Xbox Series X'],
  },
};

describe('ProductGridItemChrome', () => {
  it('renders image chrome controls and delegates interactions', () => {
    const onAddToCart = vi.fn();
    const onPrevColor = vi.fn();
    const onNextColor = vi.fn();
    const onSelectColor = vi.fn();
    const onToggleWishlist = vi.fn();

    render(
      <ProductGridImageChrome
        activeColorIndex={0}
        cartQuantity={2}
        iconSize={18}
        isAdded={false}
        isWishlisted={false}
        onAddToCart={onAddToCart}
        onNextColor={onNextColor}
        onPrevColor={onPrevColor}
        onSelectColor={onSelectColor}
        onToggleWishlist={onToggleWishlist}
        product={baseProduct}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Previous color' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next color' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select color White' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to wishlist' }));
    fireEvent.click(
      screen.getByRole('button', { name: `Add ${baseProduct.name} to cart` })
    );

    expect(onPrevColor).toHaveBeenCalledOnce();
    expect(onNextColor).toHaveBeenCalledOnce();
    expect(onSelectColor).toHaveBeenCalledWith(expect.any(Object), 1);
    expect(onToggleWishlist).toHaveBeenCalledOnce();
    expect(onAddToCart).toHaveBeenCalledWith(expect.any(Object), baseProduct);
    expect(screen.getByText('PS5')).toBeInTheDocument();
  });

  it('renders content chrome with ratings, teaser, and cart CTA', () => {
    render(
      <ProductGridContentChrome
        basePath="/ogabassey"
        cartQuantity={3}
        isAdded={false}
        product={baseProduct}
        teaserDescription="Console bundle with extra controller and fast delivery."
        viewMode="grid"
      />
    );

    expect(screen.getByText('(4.8)')).toBeInTheDocument();
    expect(screen.getByText(/Console bundle with extra controller/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View Cart (3)' })).toHaveAttribute(
      'href',
      '/ogabassey/cart'
    );
  });
});
