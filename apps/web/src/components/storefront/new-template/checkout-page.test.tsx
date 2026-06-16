import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { CartItem } from '@/hooks/cart/cart-types';

const mocks = vi.hoisted(() => ({
  cart: [
    {
      id: 'product-1',
      cartItemId: 'product-1::variant=variant-1',
      variantId: 'variant-1',
      name: 'iPhone 15 Pro',
      image: '/iphone.jpg',
      price: 1_200_000,
      quantity: 2,
    } as CartItem,
  ],
}));

vi.mock('@/hooks/use-cart', () => ({
  useCart: () => ({
    cart: mocks.cart,
    cartTotal: 2_400_000,
  }),
}));

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

vi.mock('./footer', () => ({ Footer: () => null }));
vi.mock('./navbar', () => ({ Navbar: () => null }));

import { CheckoutPage } from './checkout-page';

describe('CheckoutPage', () => {
  it('renders the checkout page with correctly mapped cart items', () => {
    mocks.cart = [
      {
        id: 'product-1',
        cartItemId: 'product-1::variant=variant-1',
        variantId: 'variant-1',
        name: 'iPhone 15 Pro',
        image: '/iphone.jpg',
        price: 1_200_000,
        quantity: 2,
      } as CartItem,
    ];
    render(<CheckoutPage />);

    // Check that we can see the item name in the cart summary
    expect(screen.getByText('iPhone 15 Pro')).toBeInTheDocument();
  });

  it('renders an empty state when the cart is empty', () => {
    mocks.cart = [];
    render(<CheckoutPage />);
    expect(screen.getByText(/Your cart is empty/i)).toBeInTheDocument();
  });

  it('associates every shipping field label with its input (WCAG 1.3.1/4.1.2)', () => {
    mocks.cart = [
      {
        id: 'product-1',
        cartItemId: 'product-1::variant=variant-1',
        variantId: 'variant-1',
        name: 'iPhone 15 Pro',
        image: '/iphone.jpg',
        price: 1_200_000,
        quantity: 2,
      } as CartItem,
    ];
    render(<CheckoutPage />);

    // getByLabelText only matches inputs whose accessible name comes from an
    // associated <label htmlFor>, so each assertion proves the association.
    for (const labelText of [
      'First Name',
      'Last Name',
      'Email Address',
      'Address',
      'City',
      'State',
      'Zip Code',
    ]) {
      expect(screen.getByLabelText(labelText)).toBeInstanceOf(
        HTMLInputElement
      );
    }
  });
});
