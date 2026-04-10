export interface AnalyticsMetricValue {
  /**
   * Percent change relative to the previous comparison window.
   * Positive values indicate growth; negative values indicate a decline.
   * Expressed in percentage points (e.g., `12.5` = +12.5%).
   */
  change: number;
  /** The metric's raw value for the current period. */
  value: number;
}

export interface MerchantAnalyticsChartPoint {
  /**
   * Human-readable bucket label rendered on the chart's X-axis (e.g.
   * "Apr 10" or "Apr"). This is intentionally a display string, not an
   * ISO date — consumers that need a machine-parsable timestamp should
   * derive it from the query range instead.
   */
  day: string;
  orders?: number;
  profit?: number;
  revenue: number;
  tax?: number;
}

export interface MerchantAnalyticsRecentSale {
  amount: number;
  /**
   * Customer email. **Contains PII** — sanitize before logging, avoid
   * persisting in plaintext analytics exports, and gate any UI that
   * surfaces it on appropriate permissions.
   */
  email: string;
  id: string;
  /** Customer display name. Contains PII; same handling as `email`. */
  name: string;
  /** ISO 8601 timestamp string, e.g. `"2026-04-10T23:59:59.999Z"`. */
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
 *
 * - `value` is a non-monetary count or magnitude (e.g. number of orders,
 *   customers, or a percentage of total).
 * - `revenue` is an optional monetary amount in the merchant's payout
 *   currency (no implicit unit conversion — callers format it with the
 *   same currency helper they use elsewhere).
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
