import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockAddToCart = vi.fn();
const mockToggleSaved = vi.fn();
const mockIsSaved = vi.fn((productId: string) => productId === 'product-1');

vi.mock('@/hooks/cart', () => ({
  useCart: vi.fn(() => ({
    addToCart: mockAddToCart,
    cart: [{ id: 'product-1', quantity: 2 }],
  })),
}));

vi.mock('../providers/v2-saved-context', () => ({
  useV2Saved: vi.fn(() => ({
    toggleSaved: mockToggleSaved,
    isSaved: mockIsSaved,
  })),
}));

import {
  ProductGridInteractionBindings,
  type ProductGridInteractionBindingsValue,
} from './ProductGridInteractionBindings';

describe('ProductGridInteractionBindings', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockAddToCart.mockClear();
    mockToggleSaved.mockClear();
    mockIsSaved.mockClear();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('provides cart quantity and wishlist state from the storefront hooks', () => {
    render(
      <ProductGridInteractionBindings>
        {(bindings: ProductGridInteractionBindingsValue) => (
          <div>
            <span>Qty {bindings.getCartQuantity('product-1')}</span>
            <span>Wish {String(bindings.isWishlisted('product-1'))}</span>
          </div>
        )}
      </ProductGridInteractionBindings>
    );

    expect(screen.getByText('Qty 2')).toBeInTheDocument();
    expect(screen.getByText('Wish true')).toBeInTheDocument();
    expect(mockIsSaved).toHaveBeenCalledWith('product-1');
  });

  it('updates added state and calls addToCart when the cart action runs', async () => {
    render(
      <ProductGridInteractionBindings>
        {(bindings: ProductGridInteractionBindingsValue) => (
          <div>
            <span>Added {String(bindings.isAdded('product-1'))}</span>
            <button
              onClick={(event) =>
                bindings.onAddToCart(event, {
                  id: 'product-1',
                  name: 'iPhone',
                  price: '₦1,000',
                  description: '',
                  image: '',
                  images: [],
                  condition: 'New',
                  manage_stock: true,
                  stock: 1,
                })
              }
            >
              Add item
            </button>
          </div>
        )}
      </ProductGridInteractionBindings>
    );

    expect(screen.getByText('Added false')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add item' }));

    expect(mockAddToCart).toHaveBeenCalled();
    expect(screen.getByText('Added true')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText('Added false')).toBeInTheDocument();
  });

  it('calls toggleSaved when wishlist interaction runs', () => {
    render(
      <ProductGridInteractionBindings>
        {(bindings: ProductGridInteractionBindingsValue) => (
          <button
            onClick={(event) =>
              bindings.onToggleWishlist(event, {
                id: 'product-2',
                name: 'Galaxy',
                price: '₦2,000',
                description: '',
                image: '',
                images: [],
                condition: 'New',
                manage_stock: true,
                stock: 1,
              })
            }
          >
            Toggle wishlist
          </button>
        )}
      </ProductGridInteractionBindings>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Toggle wishlist' }));

    expect(mockToggleSaved).toHaveBeenCalled();
  });
});
