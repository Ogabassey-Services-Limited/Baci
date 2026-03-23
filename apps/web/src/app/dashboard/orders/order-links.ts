import type { Order } from '@/app/dashboard/orders/actions';

export type DashboardOrderDetailsHref = `/dashboard/orders/${string}`;

export function getDashboardOrderDetailsHref(
  order: Pick<Order, 'orderNumber' | 'source'>
): DashboardOrderDetailsHref | null {
  if (order.source === 'jumia') {
    return null;
  }

  const normalizedOrderNumber = order.orderNumber.replace(/#/g, '').trim();
  if (normalizedOrderNumber.length === 0) {
    return null;
  }

  return `/dashboard/orders/${encodeURIComponent(normalizedOrderNumber)}`;
}
