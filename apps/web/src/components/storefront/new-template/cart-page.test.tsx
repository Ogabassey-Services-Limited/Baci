import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-cart', () => ({
  useCart: () => ({
    cart: [
      {
        id: 'product-1',
        variant_id: 'variant-1',
        name: 'iPhone 15 Pro',
        image: '/iphone.jpg',
        price: 1_200_000,
        quantity: 2,
      },
    ],
    updateQuantity: vi.fn(),
    removeFromCart: vi.fn(),
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

import { CartPage } from './cart-page';

describe('CartPage', () => {
  it('renders the remove / decrease / increase icon buttons with type="button" so they never submit a parent form', () => {
    render(<CartPage />);

    // The cart's icon-only buttons are guarded by aria-label so we can target
    // each by accessible name and assert the attribute directly.
    const removeBtn = screen.getByRole('button', { name: 'Remove item' });
    const decreaseBtn = screen.getByRole('button', {
      name: 'Decrease quantity',
    });
    const increaseBtn = screen.getByRole('button', {
      name: 'Increase quantity',
    });

    expect(removeBtn).toHaveAttribute('type', 'button');
    expect(decreaseBtn).toHaveAttribute('type', 'button');
    expect(increaseBtn).toHaveAttribute('type', 'button');
  });
});
