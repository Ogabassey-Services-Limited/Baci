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

/**
 * Period summary for the analytics dashboard.
 *
 * Fields typed as `AnalyticsMetricValue` include both the current-period
 * raw value and a percent change vs. the previous comparison window.
 *
 * Fields typed as a plain `number` are raw totals for the current period
 * with no comparison baseline attached.
 *
 * Note the deliberate `tax` vs `taxDue` split:
 * - `tax` is the raw currency total of tax collected in the period.
 * - `taxDue` wraps the same amount in an `AnalyticsMetricValue` so UI cards
 *   can render a trend arrow vs. the previous window without recomputing.
 */
export interface MerchantAnalyticsSummary {
  /** Orders placed within the last hour (live activity pulse). */
  activeNow: AnalyticsMetricValue;
  /** Average order value in the merchant's payout currency. */
  aov: AnalyticsMetricValue;
  /** Distinct customer count for the period. */
  customers: AnalyticsMetricValue;
  /** Gross margin expressed as a percentage (0-100). */
  grossMargin: AnalyticsMetricValue;
  /** Lifetime value (revenue ÷ unique customers) for the period. */
  ltv: AnalyticsMetricValue;
  /** Profit total in the merchant's payout currency. */
  profit: AnalyticsMetricValue;
  /** Refund rate expressed as a percentage (0-100). */
  refundRate: AnalyticsMetricValue;
  /** Total paid revenue in the merchant's payout currency. */
  revenue: AnalyticsMetricValue;
  /** Paid order count for the period. */
  sales: AnalyticsMetricValue;
  /** Tax due as a metric card (same underlying total as `tax` below). */
  taxDue: AnalyticsMetricValue;

  /** Raw discount total in the merchant's payout currency. */
  discounts: number;
  /** Raw shipping fee total in the merchant's payout currency. */
  shipping: number;
  /** Raw subtotal (pre-tax, pre-discount) in the merchant's payout currency. */
  subtotal: number;
  /** Raw tax total in the merchant's payout currency. */
  tax: number;
  /** Raw count of units sold across all paid orders. */
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
