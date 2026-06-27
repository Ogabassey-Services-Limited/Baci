import { describe, expect, it, vi } from 'vitest';
import type { CartItem } from '@/hooks/cart';
import {
  computeBaseCartTotal,
  getNegotiatedCartItems,
  planCartTotalNegotiation,
  runCartTotalNegotiation,
} from './cart-total-negotiation';

function makeItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: 'prod-1',
    cartItemId: 'prod-1',
    name: 'iPhone 16',
    description: '',
    status: 'active',
    price: 100000,
    manage_stock: true,
    stock: 5,
    image: '',
    imageLarge: '',
    imageHint: '',
    brand: 'Apple',
    gtin: '',
    mpn: '',
    quantity: 1,
    ...overrides,
  } as CartItem;
}

describe('getNegotiatedCartItems', () => {
  it('returns only lines with an accepted offer or a negotiated price', () => {
    const accepted = makeItem({ cartItemId: 'a', negotiationStatus: 'accepted' });
    const priced = makeItem({ cartItemId: 'b', negotiatedPrice: 90000 });
    const plain = makeItem({ cartItemId: 'c' });

    const result = getNegotiatedCartItems([accepted, priced, plain]);

    expect(result.map((item) => item.cartItemId)).toEqual(['a', 'b']);
  });
});

describe('computeBaseCartTotal', () => {
  it('sums catalog line prices ignoring any negotiated price', () => {
    const total = computeBaseCartTotal([
      makeItem({ price: 100000, quantity: 2, negotiatedPrice: 1 }),
      makeItem({ cartItemId: 'b', price: 50000, quantity: 1 }),
    ]);

    expect(total).toBe(250000);
  });

  it('adds assurance at the item rate when enabled', () => {
    const total = computeBaseCartTotal([
      makeItem({ price: 100000, quantity: 1, hasAssurance: true, assuranceRate: 0.1 }),
    ]);

    expect(total).toBe(110000);
  });
});

describe('planCartTotalNegotiation', () => {
  it('opens at the supplied display total when no individual offers exist', () => {
    const plan = planCartTotalNegotiation(
      [makeItem({ price: 100000, quantity: 1 })],
      100000
    );

    expect(plan.requiresReset).toBe(false);
    expect(plan.itemsToReset).toEqual([]);
    expect(plan.currentPrice).toBe(100000);
  });

  it('requires reset and negotiates from the base total when offers exist', () => {
    const offered = makeItem({
      cartItemId: 'a',
      price: 100000,
      quantity: 1,
      negotiatedPrice: 80000,
      negotiationStatus: 'accepted',
    });
    const plain = makeItem({ cartItemId: 'b', price: 50000, quantity: 1 });

    const plan = planCartTotalNegotiation([offered, plain], 130000);

    expect(plan.requiresReset).toBe(true);
    expect(plan.itemsToReset.map((item) => item.cartItemId)).toEqual(['a']);
    // Base total ignores the 80k offer — uses catalog 100k + 50k.
    expect(plan.currentPrice).toBe(150000);
  });
});

describe('runCartTotalNegotiation', () => {
  const offered = makeItem({
    cartItemId: 'a',
    price: 100000,
    quantity: 1,
    negotiatedPrice: 80000,
    negotiationStatus: 'accepted',
  });

  it('opens at the display total without resetting when no offers exist', () => {
    const openBulk = vi.fn();
    const clearNegotiatedPrice = vi.fn();
    const confirmReset = vi.fn(() => true);

    runCartTotalNegotiation({
      cart: [makeItem({ price: 100000, quantity: 1 })],
      fallbackTotal: 100000,
      clearNegotiatedPrice,
      confirmReset,
      openBulk,
    });

    expect(confirmReset).not.toHaveBeenCalled();
    expect(clearNegotiatedPrice).not.toHaveBeenCalled();
    expect(openBulk).toHaveBeenCalledWith(100000);
  });

  it('clears individual offers and opens from the base total once confirmed', () => {
    const openBulk = vi.fn();
    const clearNegotiatedPrice = vi.fn();

    runCartTotalNegotiation({
      cart: [offered],
      fallbackTotal: 80000,
      clearNegotiatedPrice,
      confirmReset: () => true,
      openBulk,
    });

    expect(clearNegotiatedPrice).toHaveBeenCalledWith('a');
    expect(openBulk).toHaveBeenCalledWith(100000);
  });

  it('aborts without clearing when the reset is declined', () => {
    const openBulk = vi.fn();
    const clearNegotiatedPrice = vi.fn();

    runCartTotalNegotiation({
      cart: [offered],
      fallbackTotal: 80000,
      clearNegotiatedPrice,
      confirmReset: () => false,
      openBulk,
    });

    expect(clearNegotiatedPrice).not.toHaveBeenCalled();
    expect(openBulk).not.toHaveBeenCalled();
  });

  it('bails when offers exist but no clear action is available', () => {
    const openBulk = vi.fn();
    const confirmReset = vi.fn(() => true);

    runCartTotalNegotiation({
      cart: [offered],
      fallbackTotal: 80000,
      clearNegotiatedPrice: undefined,
      confirmReset,
      openBulk,
    });

    expect(confirmReset).not.toHaveBeenCalled();
    expect(openBulk).not.toHaveBeenCalled();
  });
});
