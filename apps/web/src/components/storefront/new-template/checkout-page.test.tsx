import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-cart', () => ({
  useCart: () => ({
    cart: [
      {
        id: 'product-1',
        cartItemId: 'product-1::variant=variant-1',
        variantId: 'variant-1',
        name: 'iPhone 15 Pro',
        image: '/iphone.jpg',
        price: 1_200_000,
        quantity: 2,
      },
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
  it('renders a typed cart item summary with variant-backed cart items', () => {
    render(<CheckoutPage />);

    expect(screen.getByText('iPhone 15 Pro')).toBeInTheDocument();
    expect(screen.getByText('Qty: 2')).toBeInTheDocument();
    expect(screen.getAllByText('₦2,400,000')).toHaveLength(3);
  });
});
