import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { CartItem } from '@/hooks/cart/cart-types';

vi.mock('@/hooks/use-cart', () => ({
  useCart: () => ({
    cart: [
      {
        id: 'product-1',
        variantId: 'variant-1',
        name: 'iPhone 15 Pro',
        image: '/iphone.jpg',
        price: 1_200_000,
        quantity: 2,
      } as CartItem,
    ],
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
    render(<CheckoutPage />);

    // Check that we can see the item name in the cart summary
    expect(screen.getByText('iPhone 15 Pro')).toBeInTheDocument();
  });
});
