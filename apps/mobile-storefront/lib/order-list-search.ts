import { getCustomerOrderStatusMeta } from '@/lib/customer-order-status';

export interface OrderListSearchItemLike {
  product_name?: string | null;
}

export interface OrderListSearchOrderLike {
  items?: OrderListSearchItemLike[] | null;
  order_number?: string | null;
  shipping_status?: string | null;
}

function normalizeSearchQuery(query: string): string {
  return query.toLowerCase().trim();
}

export function matchesOrderListSearchQuery(
  order: OrderListSearchOrderLike,
  searchQuery: string
): boolean {
  const query = normalizeSearchQuery(searchQuery);

  if (!query) {
    return true;
  }

  const orderNumberMatch = order.order_number?.toLowerCase().includes(query);
  const statusMeta = getCustomerOrderStatusMeta(order.shipping_status);
  const statusMatch =
    statusMeta.label.toLowerCase().includes(query) ||
    statusMeta.shortLabel.toLowerCase().includes(query);
  const itemMatch = order.items?.some((item) =>
    item.product_name?.toLowerCase().includes(query)
  );

  return Boolean(orderNumberMatch || statusMatch || itemMatch);
}

export function filterOrdersBySearchQuery<T extends OrderListSearchOrderLike>(
  orders: T[],
  searchQuery: string
): T[] {
  const query = normalizeSearchQuery(searchQuery);

  if (!query) {
    return orders;
  }

  return orders.filter((order) => matchesOrderListSearchQuery(order, query));
}
