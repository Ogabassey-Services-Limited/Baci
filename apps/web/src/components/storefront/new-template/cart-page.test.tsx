import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CartItem } from '@/hooks/cart/cart-types';

type TestCartItem = CartItem & {
  variant_id?: string;
  variantColor?: string;
  variantStorage?: string;
};

const mocks = vi.hoisted(() => ({
  cart: [] as TestCartItem[],
  updateQuantity: vi.fn(),
  removeFromCart: vi.fn(),
}));

vi.mock('@/hooks/use-cart', () => ({
  useCart: () => ({
    cart: mocks.cart,
    updateQuantity: mocks.updateQuantity,
    removeFromCart: mocks.removeFromCart,
    cartTotal: mocks.cart.reduce(
      (total, item) => total + item.price * item.quantity,
      0
    ),
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
  beforeEach(() => {
    mocks.cart = [
      {
        id: 'product-1',
        cartItemId: 'product-1::variant=variant-1::color=Black',
        variantId: 'variant-1',
        name: 'iPhone 15 Pro',
        image: '/iphone.jpg',
        price: 1_200_000,
        quantity: 2,
        selectedColor: 'Black',
        selectedStorage: '256GB',
      } as TestCartItem,
    ];
    mocks.updateQuantity.mockReset();
    mocks.removeFromCart.mockReset();
  });

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

  it('targets cart mutations by cart item id for distinct product variant lines', () => {
    render(<CartPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove item' }));
    fireEvent.click(screen.getByRole('button', { name: 'Decrease quantity' }));
    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));

    expect(mocks.removeFromCart).toHaveBeenCalledWith(
      'product-1::variant=variant-1::color=Black',
      undefined
    );
    expect(mocks.updateQuantity).toHaveBeenNthCalledWith(
      1,
      'product-1::variant=variant-1::color=Black',
      1,
      undefined
    );
    expect(mocks.updateQuantity).toHaveBeenNthCalledWith(
      2,
      'product-1::variant=variant-1::color=Black',
      3,
      undefined
    );
  });

  it('preserves legacy variant ids and labels from stored cart JSON', () => {
    mocks.cart = [
      {
        id: 'product-legacy',
        variant_id: 'legacy-variant',
        variantColor: 'Blue',
        variantStorage: '512GB',
        name: 'Galaxy S26',
        image: '/galaxy.jpg',
        price: 980_000,
        quantity: 2,
      } as TestCartItem,
    ];

    render(<CartPage />);

    expect(screen.getByText('Blue')).toBeInTheDocument();
    expect(screen.getByText('512GB')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove item' }));

    expect(mocks.removeFromCart).toHaveBeenCalledWith(
      'product-legacy',
      'legacy-variant'
    );
  });
});
