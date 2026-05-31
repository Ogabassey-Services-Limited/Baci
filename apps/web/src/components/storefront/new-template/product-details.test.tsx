import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  savedItems: [] as string[],
  cart: [] as Array<{
    id: string;
    cartItemId: string;
    name: string;
    image: string;
    price: number;
    quantity: number;
    variantId?: string;
  }>,
  toggleSaved: vi.fn(),
  addToCart: vi.fn(),
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

describe('ProductDetails save button', () => {
  beforeEach(() => {
    mocks.savedItems = [];
    mocks.cart = [];
    mocks.toggleSaved.mockReset();
    mocks.addToCart.mockReset();
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

  it('renders with typed variant cart items already in the cart', () => {
    mocks.cart = [
      {
        id: '1',
        cartItemId: '1::variant=black',
        variantId: 'black',
        name: 'iPhone 15 Pro',
        image: '/iphone.jpg',
        price: 1_200_000,
        quantity: 2,
      },
    ];

    render(<ProductDetails />);

    expect(screen.getByRole('button', { name: 'Save product' })).toBeVisible();
  });
});
