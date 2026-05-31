import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CartItem } from '@/hooks/cart/cart-types';

const mocks = vi.hoisted(() => ({
  savedItems: [] as string[],
  toggleSaved: vi.fn(),
  addToCart: vi.fn(),
  cart: [] as CartItem[],
}));

vi.mock('next/image', () => ({
  default: () => 'img',
}));

vi.mock('next/link', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('next/navigation', () => ({
  useParams: vi.fn(() => ({ productSlug: '1' })),
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn() })),
}));

vi.mock('@/hooks/use-cart', () => ({
  useCart: vi.fn(() => ({
    addToCart: mocks.addToCart,
    cart: mocks.cart,
  })),
}));

vi.mock('./footer', () => ({
  Footer: () => null,
}));

vi.mock('./navbar', () => ({
  Navbar: () => null,
}));

vi.mock('./negotiation-modal', () => ({
  NegotiationModal: () => null,
}));

vi.mock('./saved-context', () => ({
  useSaved: vi.fn(() => ({
    savedItems: mocks.savedItems,
    toggleSaved: mocks.toggleSaved,
  })),
}));

import { ProductDetails } from './product-details';

function renderInsideForm(onSubmit = vi.fn()) {
  render(
    <form onSubmit={onSubmit}>
      <ProductDetails />
    </form>
  );
  return onSubmit;
}

describe('ProductDetails', () => {
  beforeEach(() => {
    mocks.savedItems = [];
    mocks.toggleSaved.mockReset();
    mocks.addToCart.mockReset();
    mocks.cart = [];
    window.scrollTo = vi.fn();
  });

  it('does not submit an enclosing form when saving a product', () => {
    const onSubmit = renderInsideForm();

    fireEvent.click(screen.getByRole('button', { name: 'Save product' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(mocks.toggleSaved).toHaveBeenCalledWith('1');
  });

  it('does not submit an enclosing form when removing a saved product', () => {
    mocks.savedItems = ['1'];
    const onSubmit = renderInsideForm();

    fireEvent.click(screen.getByRole('button', { name: 'Remove from saved' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(mocks.toggleSaved).toHaveBeenCalledWith('1');
  });

  it('calculates the quantity of a product in the cart without crashing by using CartItem interface mapping', () => {
    mocks.cart = [
      {
        id: '1',
        variantId: 'variant-1',
        name: 'iPhone 15 Pro Max',
        image: '/iphone.jpg',
        price: 1_200_000,
        quantity: 2,
      } as CartItem,
    ];

    // Test passes if component renders successfully with the typed cart item object
    render(<ProductDetails />);

    expect(screen.getAllByText('iPhone 15 Pro Max').length).toBeGreaterThan(0);
  });
});
