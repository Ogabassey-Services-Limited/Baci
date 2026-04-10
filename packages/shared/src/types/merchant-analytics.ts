export interface AnalyticsMetricValue {
  change: number;
  value: number;
}

export interface MerchantAnalyticsChartPoint {
  day: string;
  orders?: number;
  profit?: number;
  revenue: number;
  tax?: number;
}

export interface MerchantAnalyticsRecentSale {
  amount: number;
  email: string;
  id: string;
  name: string;
  time: string;
}

export interface MerchantAnalyticsTopProduct {
  id: string;
  name: string;
  revenue: number;
  units: number;
}

export interface MerchantAnalyticsBreakdownItem {
  name: string;
  value: number;
}

/**
 * Extends `MerchantAnalyticsBreakdownItem` with an optional revenue column so
 * the same row shape can be used for "top X" lists that want to render both a
 * count and a monetary value without introducing a separate type.
 */
export interface MerchantAnalyticsNamedValue
  extends MerchantAnalyticsBreakdownItem {
  revenue?: number;
}

export interface MerchantBlogTopPost {
  id: string;
  slug: string;
  title: string;
  viewCount: number;
}

export interface MerchantBlogAnalyticsSummary {
  draftPosts: number;
  publishedPosts: number;
  topPost: MerchantBlogTopPost | null;
  totalPosts: number;
  totalViews: number;
}

export interface MerchantAnalyticsSummary {
  activeNow: AnalyticsMetricValue;
  aov: AnalyticsMetricValue;
  customers: AnalyticsMetricValue;
  grossMargin: AnalyticsMetricValue;
  ltv: AnalyticsMetricValue;
  profit: AnalyticsMetricValue;
  refundRate: AnalyticsMetricValue;
  revenue: AnalyticsMetricValue;
  sales: AnalyticsMetricValue;
  taxDue: AnalyticsMetricValue;
  discounts: number;
  shipping: number;
  subtotal: number;
  tax: number;
  totalUnitsSold: number;
}

export interface MerchantAnalyticsResponse {
  blog: MerchantBlogAnalyticsSummary;
  brandBreakdown: MerchantAnalyticsNamedValue[];
  chartData: MerchantAnalyticsChartPoint[];
  customerBreakdown: MerchantAnalyticsNamedValue[];
  recentSales: MerchantAnalyticsRecentSale[];
  salesByChannel: MerchantAnalyticsBreakdownItem[];
  salesByPaymentMethod: MerchantAnalyticsBreakdownItem[];
  summary: MerchantAnalyticsSummary;
  topBrand: MerchantAnalyticsNamedValue | null;
  topCustomer: MerchantAnalyticsNamedValue | null;
  topPaymentMethod: MerchantAnalyticsNamedValue | null;
  topProducts: MerchantAnalyticsTopProduct[];
}
