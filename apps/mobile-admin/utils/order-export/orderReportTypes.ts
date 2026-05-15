import type { Order } from '@baci/shared';

export interface OrderItemQueryData {
  price: number;
  product_id: string;
  products: { name: string } | null;
  quantity: number;
}

export interface GroupedOrderMetric {
  count: number;
  total: number;
}

export interface TopProductInsight {
  name: string;
  qty: number;
  revenue: number;
}

export interface OrderReportSummary {
  completedCount: number;
  pendingCount: number;
  processingCount: number;
  salesByOrigin: Array<[string, GroupedOrderMetric]>;
  salesByPaymentMethod: Array<[string, GroupedOrderMetric]>;
  topProduct: TopProductInsight | null;
  totalDiscounts: number;
  totalOrders: number;
  totalRevenue: number;
  totalShipping: number;
  totalSubtotal: number;
  totalTax: number;
  totalUnitsSold: number;
}

export interface OrderReportHtmlInput {
  dateRangeLabel: string;
  generatedAt: Date;
  logoUrl?: string;
  orders: Order[];
  storeName: string;
  summary: OrderReportSummary;
}
