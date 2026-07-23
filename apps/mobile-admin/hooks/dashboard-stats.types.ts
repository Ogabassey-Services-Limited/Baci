export type TimePeriod = 'today' | 'week' | 'month' | 'all';

export interface DashboardStats {
  orders: number;
  totalItems: number;
  visits: number;
  avgOrderValue: number;
  newCustomers: number;
  totalCustomers: number;
  pendingOrders: number;
  revenue: number;
  previousPeriodRevenue: number;
}

export interface RevenueDataPoint {
  id: string;
  label: string;
  value: number;
}

export interface TopProduct {
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
  totalSold: number;
  totalRevenue: number;
}
