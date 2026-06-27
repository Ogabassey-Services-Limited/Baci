import { describe, expect, it } from 'vitest';
import {
  inferBumpaOrderItemPrices,
  type ProvisionalBumpaOrderItem,
} from './infer-bumpa-order-item-prices';

function createItem(
  overrides: Partial<ProvisionalBumpaOrderItem> = {}
): ProvisionalBumpaOrderItem {
  return {
    productId: null,
    productName: 'Widget',
    sku: null,
    quantity: 1,
    matched: false,
    matchSource: 'unmatched',
    provisionalUnitPrice: null,
    provisionalLineTotal: null,
    ...overrides,
  };
}

describe('inferBumpaOrderItemPrices', () => {
  it('infers unknown unit prices from subtotal and quantity', () => {
    expect(
      inferBumpaOrderItemPrices(1000, [createItem({ quantity: 2 })])
    ).toEqual([
      expect.objectContaining({
        quantity: 2,
        unitPrice: 500,
        lineTotal: 1000,
      }),
    ]);
  });

  it('keeps explicit rich line totals even when subtotal differs', () => {
    expect(
      inferBumpaOrderItemPrices(900, [
        createItem({
          quantity: 2,
          provisionalLineTotal: 1000,
        }),
      ])
    ).toEqual([
      expect.objectContaining({
        quantity: 2,
        unitPrice: 500,
        lineTotal: 1000,
      }),
    ]);
  });

  it('shares subtotal across multiple fully inferred items', () => {
    expect(
      inferBumpaOrderItemPrices(1000, [
        createItem({ productName: 'Phone' }),
        createItem({ productName: 'Case' }),
      ])
    ).toEqual([
      expect.objectContaining({
        productName: 'Phone',
        unitPrice: 500,
        lineTotal: 500,
      }),
      expect.objectContaining({
        productName: 'Case',
        unitPrice: 500,
        lineTotal: 500,
      }),
    ]);
  });

  it('absorbs rounding deltas only into fully inferred items', () => {
    expect(
      inferBumpaOrderItemPrices(100.01, [
        createItem({
          productName: 'Known price',
          provisionalUnitPrice: 30,
        }),
        createItem({
          productName: 'Unknown bundle',
          quantity: 3,
        }),
      ])
    ).toEqual([
      expect.objectContaining({
        productName: 'Known price',
        unitPrice: 30,
        lineTotal: 30,
      }),
      expect.objectContaining({
        productName: 'Unknown bundle',
        quantity: 3,
        unitPrice: 23.34,
        lineTotal: 70.01,
      }),
    ]);
  });

  it('does not create negative prices when known totals exceed subtotal', () => {
    expect(
      inferBumpaOrderItemPrices(50, [
        createItem({
          productName: 'Known total',
          provisionalLineTotal: 100,
        }),
        createItem({
          productName: 'Unknown item',
        }),
      ])
    ).toEqual([
      expect.objectContaining({
        productName: 'Known total',
        lineTotal: 100,
      }),
      expect.objectContaining({
        productName: 'Unknown item',
        unitPrice: 0,
        lineTotal: 0,
      }),
    ]);
  });
});
