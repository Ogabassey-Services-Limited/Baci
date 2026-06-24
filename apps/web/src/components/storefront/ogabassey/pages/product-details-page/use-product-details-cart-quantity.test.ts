import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildCartItemId,
  type NormalizedProductDetails,
} from './product-details-helpers';
import { useProductDetailsCartQuantity } from './use-product-details-cart-quantity';

const productData = {
  id: 'product-1',
  colors: [{ name: 'Black' }, { name: 'Silver' }],
} as unknown as NormalizedProductDetails;

type CartItem = {
  cartItemId: string;
  id: string;
  quantity: number;
};

function renderCartQuantity(
  cart: CartItem[],
  overrides: Partial<{
    selectedColor: number | null;
    selectedAttributes: Record<string, string>;
    currentVariantId?: string;
  }> = {}
) {
  return renderHook(
    (props: { cart: CartItem[] }) =>
      useProductDetailsCartQuantity({
        cart: props.cart as never,
        currentVariantId: overrides.currentVariantId,
        productData,
        secondaryColor: null,
        selectedAttributes: overrides.selectedAttributes ?? {},
        selectedColor:
          overrides.selectedColor === undefined ? 0 : overrides.selectedColor,
        selectedCondition: 'new',
      }),
    { initialProps: { cart } }
  );
}

describe('useProductDetailsCartQuantity', () => {
  afterEach(() => {
    cleanup();
  });

  it('derives the cart item id from the current selection', () => {
    const { result } = renderCartQuantity([]);

    expect(result.current.currentCartItemId).toBe(
      buildCartItemId('product-1', {
        color: 'Black',
        condition: 'new',
        selectedAttributes: {},
      })
    );
  });

  it('returns the matching quantity and seeds the input from the cart', () => {
    const cartItemId = buildCartItemId('product-1', {
      color: 'Black',
      condition: 'new',
      selectedAttributes: {},
    });
    const { result } = renderCartQuantity([
      { cartItemId, id: 'product-1', quantity: 3 },
    ]);

    expect(result.current.quantityInCart).toBe(3);
    expect(result.current.inputValue).toBe('3');
  });

  it('reports zero with an empty input when no cart item matches', () => {
    const { result } = renderCartQuantity([
      { cartItemId: 'other::color=Red', id: 'product-1', quantity: 9 },
    ]);

    expect(result.current.quantityInCart).toBe(0);
    expect(result.current.inputValue).toBe('');
  });

  it('syncs the input value when the cart quantity changes', () => {
    const cartItemId = buildCartItemId('product-1', {
      color: 'Black',
      condition: 'new',
      selectedAttributes: {},
    });

    const { result, rerender } = renderCartQuantity([
      { cartItemId, id: 'product-1', quantity: 1 },
    ]);

    expect(result.current.inputValue).toBe('1');

    rerender({ cart: [{ cartItemId, id: 'product-1', quantity: 5 }] });

    expect(result.current.quantityInCart).toBe(5);
    expect(result.current.inputValue).toBe('5');
  });

  it('preserves manual input edits until the cart quantity changes', () => {
    const cartItemId = buildCartItemId('product-1', {
      color: 'Black',
      condition: 'new',
      selectedAttributes: {},
    });
    const { result } = renderCartQuantity([
      { cartItemId, id: 'product-1', quantity: 2 },
    ]);

    act(() => {
      result.current.setInputValue('');
    });

    expect(result.current.inputValue).toBe('');
    // Quantity in cart is still 2 because no cart change occurred.
    expect(result.current.quantityInCart).toBe(2);
  });

  it('matches legacy hyphen-format cart items for the same product', () => {
    const { result } = renderCartQuantity([
      { cartItemId: 'product-1-black-new', id: 'product-1', quantity: 4 },
    ]);

    expect(result.current.quantityInCart).toBe(4);
    expect(result.current.inputValue).toBe('4');
  });
});
