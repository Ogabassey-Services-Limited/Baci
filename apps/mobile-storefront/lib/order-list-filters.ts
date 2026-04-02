import { getCustomerOrderStatusKey } from './customer-order-status';

export type OrderListFilterKey = 'all' | 'active' | 'delivered' | 'closed';

export interface FilterableOrder {
  shipping_status: string;
}

export interface OrderListFilterOption {
  key: OrderListFilterKey;
  label: string;
  count: number;
}

export function matchesOrderListFilter(
  order: FilterableOrder,
  filter: OrderListFilterKey
): boolean {
  const status = getCustomerOrderStatusKey(order.shipping_status);

  switch (filter) {
    case 'active':
      return status === 'placed' || status === 'confirmed' || status === 'shipped';
    case 'delivered':
      return status === 'delivered';
    case 'closed':
      return status === 'cancelled' || status === 'returned';
    case 'all':
    default:
      return true;
  }
}

export function buildOrderListFilters(
  orders: FilterableOrder[]
): OrderListFilterOption[] {
  return [
    { key: 'all', label: 'All', count: orders.length },
    {
      key: 'active',
      label: 'Active',
      count: orders.filter((order) => matchesOrderListFilter(order, 'active'))
        .length,
    },
    {
      key: 'delivered',
      label: 'Delivered',
      count: orders.filter((order) => matchesOrderListFilter(order, 'delivered'))
        .length,
    },
    {
      key: 'closed',
      label: 'Closed',
      count: orders.filter((order) => matchesOrderListFilter(order, 'closed'))
        .length,
    },
  ];
}
