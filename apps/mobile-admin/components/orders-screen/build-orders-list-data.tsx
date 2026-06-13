import type { Order } from '@/hooks/useOrders';
import { groupOrdersByRelativeDate } from '@/utils/date-utils';
import type { OrdersListRow } from './types';

export function buildOrdersListData(allOrders: Order[]) {
  const rows: OrdersListRow[] = [];

  groupOrdersByRelativeDate(allOrders).forEach((section, sectionIndex) => {
    if (section.data.length === 0) return;

    rows.push({
      type: 'header',
      id: `header-${section.title}-${sectionIndex}`,
      title: section.title,
    });
    section.data.forEach((order) => {
      rows.push({ type: 'item', id: order.id, order });
    });
  });

  return rows;
}
