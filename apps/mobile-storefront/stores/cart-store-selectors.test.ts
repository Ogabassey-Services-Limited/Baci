import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../lib/storage', () => ({
  syncStorage: {
    getItem: jest.fn(() => null),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

import {
  type CartItem,
  selectCartQuantities,
  useCartStore,
} from './cart-store';

function cartItem(id: string, productId: string, quantity: number): CartItem {
  return {
    id,
    product_id: productId,
    slug: productId,
    name: productId,
    price: 1000,
    quantity,
  };
}

describe('selectCartQuantities', () => {
  beforeEach(() => {
    useCartStore.setState({ items: [], isLoading: false, lineSequence: 0 });
  });

  it('sums quantities per product across cart lines', () => {
    useCartStore.setState({
      items: [
        cartItem('line-1', 'p1', 2),
        cartItem('line-2', 'p1', 3),
        cartItem('line-3', 'p2', 1),
      ],
      isLoading: false,
      lineSequence: 3,
    });

    const counts = selectCartQuantities(useCartStore.getState());

    expect(counts.get('p1')).toBe(5);
    expect(counts.get('p2')).toBe(1);
    expect(counts.get('p3') ?? 0).toBe(0);
  });

  it('memoizes the map until items change', () => {
    useCartStore.setState({
      items: [cartItem('line-1', 'p1', 1)],
      isLoading: false,
      lineSequence: 1,
    });
    const first = selectCartQuantities(useCartStore.getState());

    expect(selectCartQuantities(useCartStore.getState())).toBe(first);

    useCartStore.setState({
      items: [cartItem('line-1', 'p1', 1), cartItem('line-2', 'p2', 1)],
      isLoading: false,
      lineSequence: 2,
    });

    expect(selectCartQuantities(useCartStore.getState())).not.toBe(first);
  });
});
