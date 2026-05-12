import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  savedItems: [] as string[],
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
    cart: [],
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
});
