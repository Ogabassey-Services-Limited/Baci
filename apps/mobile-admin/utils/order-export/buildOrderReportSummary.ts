import type { Order } from '@baci/shared';
import type {
  GroupedOrderMetric,
  OrderItemQueryData,
  OrderReportSummary,
} from './orderReportTypes';

function groupOrders(
  orders: Order[],
  keyGetter: (order: Order) => string
): Array<[string, GroupedOrderMetric]> {
  const groups = new Map<string, GroupedOrderMetric>();

  for (const order of orders) {
    const key = keyGetter(order) || 'Unknown';
    const current = groups.get(key) || { count: 0, total: 0 };
    groups.set(key, {
      count: current.count + 1,
      total: current.total + (Number(order.total) || 0),
    });
  }

  return Array.from(groups.entries()).sort((left, right) => {
    return right[1].total - left[1].total;
  });
}

export function buildOrderReportSummary(
  orders: Order[],
  itemData: OrderItemQueryData[]
): OrderReportSummary {
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce(
    (sum, order) => sum + (Number(order.total) || 0),
    0
  );
  const totalSubtotal = orders.reduce(
    (sum, order) => sum + (Number(order.subtotal) || 0),
    0
  );
  const totalShipping = orders.reduce(
    (sum, order) => sum + (Number(order.shipping_fee) || 0),
    0
  );
  const totalDiscounts = orders.reduce(
    (sum, order) => sum + (Number(order.discount_amount) || 0),
    0
  );
  const totalTax = orders.reduce(
    (sum, order) => sum + (Number(order.tax_amount) || 0),
    0
  );
  const pendingCount = orders.filter(
    (order) => order.shipping_status === 'pending'
  ).length;
  const processingCount = orders.filter(
    (order) => order.shipping_status === 'processing'
  ).length;
  const completedCount = orders.filter(
    (order) => order.shipping_status === 'delivered'
  ).length;
  const totalUnitsSold = itemData.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0),
    0
  );

  const productStats: Record<
    string,
    { name: string; qty: number; revenue: number }
  > = {};
  for (const item of itemData) {
    const name = item.products?.name || 'Unknown Product';
    if (!productStats[name]) {
      productStats[name] = { name, qty: 0, revenue: 0 };
    }
    productStats[name].qty += Number(item.quantity) || 0;
    productStats[name].revenue +=
      (Number(item.quantity) || 0) * (Number(item.price) || 0);
  }

  const topProduct =
    Object.values(productStats).sort((left, right) => {
      return right.qty - left.qty;
    })[0] || null;

  return {
    completedCount,
    pendingCount,
    processingCount,
    salesByOrigin: groupOrders(orders, (order) => order.source || 'Direct'),
    salesByPaymentMethod: groupOrders(
      orders,
      (order) => order.payment_method || 'Other'
    ),
    topProduct,
    totalDiscounts,
    totalOrders,
    totalRevenue,
    totalShipping,
    totalSubtotal,
    totalTax,
    totalUnitsSold,
  };
}
