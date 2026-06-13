import type { Order } from '@/hooks/useOrders';

export function dedupeOrdersById(orders: Order[]) {
  const seenIds = new Set<string>();

  return orders.filter((order) => {
    if (seenIds.has(order.id)) return false;
    seenIds.add(order.id);
    return true;
  });
}
