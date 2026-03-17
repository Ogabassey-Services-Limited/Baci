import { isValidCartStore } from '@/lib/cart-validation';

describe('isValidCartStore', () => {
  it('returns true for a valid cart store shape', () => {
    expect(
      isValidCartStore({
        items: [],
        itemCount: () => 0,
        subtotal: () => 0,
        updateQuantity: () => {},
        removeItem: () => {},
        clearCart: () => {},
        toggleAssurance: () => {},
      })
    ).toBe(true);
  });

  it('returns true for a valid cart store with items', () => {
    expect(
      isValidCartStore({
        items: [{ id: 'product-1', quantity: 2 }],
        itemCount: () => 1,
        subtotal: () => 500000,
        updateQuantity: () => {},
        removeItem: () => {},
        clearCart: () => {},
        toggleAssurance: () => {},
      })
    ).toBe(true);
  });

  it('returns false for invalid or missing fields', () => {
    const methodsOnly = {
      itemCount: () => 0,
      subtotal: () => 0,
      updateQuantity: () => {},
      removeItem: () => {},
      clearCart: () => {},
      toggleAssurance: () => {},
    };

    expect(isValidCartStore(undefined)).toBe(false);
    expect(isValidCartStore(null)).toBe(false);
    expect(isValidCartStore({})).toBe(false);
    expect(isValidCartStore(methodsOnly)).toBe(false);
    expect(
      isValidCartStore({
        items: {},
        itemCount: () => 0,
        subtotal: () => 0,
        updateQuantity: () => {},
        removeItem: () => {},
        clearCart: () => {},
        toggleAssurance: () => {},
      })
    ).toBe(false);
    expect(
      isValidCartStore({
        items: [],
        itemCount: () => 0,
        subtotal: () => 0,
        updateQuantity: 'nope',
        removeItem: () => {},
        clearCart: () => {},
        toggleAssurance: () => {},
      })
    ).toBe(false);
    expect(
      isValidCartStore({
        items: [],
        itemCount: () => 0,
        subtotal: () => 0,
        updateQuantity: () => {},
        removeItem: 'nope',
        clearCart: null,
        toggleAssurance: 123,
      })
    ).toBe(false);
    expect(
      isValidCartStore({
        items: [{ id: 1, quantity: '2' }],
        itemCount: () => 0,
        subtotal: () => 0,
        updateQuantity: () => {},
        removeItem: () => {},
        clearCart: () => {},
        toggleAssurance: () => {},
      })
    ).toBe(false);
  });
});
