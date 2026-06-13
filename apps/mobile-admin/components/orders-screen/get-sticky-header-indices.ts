import type { OrdersListRow } from './types';

export function getStickyHeaderIndices(rows: OrdersListRow[]) {
  return rows
    .map((item, index) => (item.type === 'header' ? index : null))
    .filter((index): index is number => index !== null);
}
