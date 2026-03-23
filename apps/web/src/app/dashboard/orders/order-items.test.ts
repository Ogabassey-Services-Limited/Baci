import { describe, expect, it } from 'vitest';
import { getOrderItems } from './order-items';

describe('getOrderItems', () => {
  it('returns parsed typed items from the items field', () => {
    expect(
      getOrderItems({
        items: [{ id: 'item-1', name: 'Widget', quantity: 1, price: 1000 }],
      })
    ).toEqual([{ id: 'item-1', name: 'Widget', quantity: 1, price: 1000 }]);
  });

  it('falls back to the order_items field when items is not usable', () => {
    expect(
      getOrderItems({
        items: [],
        order_items: [
          { id: 'item-2', name: 'Gadget', quantity: 2, price: 2500 },
        ],
      })
    ).toEqual([{ id: 'item-2', name: 'Gadget', quantity: 2, price: 2500 }]);
  });
});
