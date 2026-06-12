import { describe, expect, it, vi } from 'vitest';
import type { Order } from '@/hooks/useOrders';
import {
  buildOrdersListData,
  dedupeOrdersById,
  getStickyHeaderIndices,
} from './orders-list-data';

vi.mock('@/utils/date-utils', () => ({
  groupOrdersByRelativeDate: (orders: Order[]) => [
    { title: 'Today', data: orders },
  ],
}));

const orders = [{ id: 'order-1' }, { id: 'order-2' }] as Order[];

describe('orders-list-data', () => {
  it('builds sticky section rows for grouped orders', () => {
    const rows = buildOrdersListData(orders);

    expect(rows).toEqual([
      { type: 'header', id: 'header-Today-0', title: 'Today' },
      { type: 'item', id: 'order-1', order: orders[0] },
      { type: 'item', id: 'order-2', order: orders[1] },
    ]);
    expect(getStickyHeaderIndices(rows)).toEqual([0]);
  });

  it('deduplicates orders by id while keeping first occurrence', () => {
    expect(dedupeOrdersById([orders[0], orders[0], orders[1]])).toEqual(orders);
  });
});
