/**
 * Platform summary metrics for the selected admin window.
 * Monetary fields are reported in the platform's minor-unit normalized currency.
 */
export interface PlatformSummary {
  /** Paid GMV only for the selected window. */
  totalGmv: number;
  /** Gross order value across all orders in the selected window, regardless of payment state. */
  grossGmv: number;
  gmvChange: number;
  activeMerchants: number;
  totalMerchants: number;
  /** Paid order count only for the selected window. */
  totalOrders: number;
  /** Gross order count across all orders in the selected window, regardless of payment state. */
  grossOrders: number;
  /** Percentage change in paid order count versus the immediately preceding matching window, on a 0-100 scale. */
  orderChange: number;
  /** Average value of paid orders in the selected window, calculated as paid GMV divided by paid order count. */
  avgOrderValue: number;
  /** Percentage change in paid-order average order value versus the immediately preceding matching window, on a 0-100 scale. */
  aovChange: number;
  avgGmvPerMerchant: number;
  platformRevenue: number;
  processorFees: number;
  netToMerchants: number;
}

export interface MerchantHealthBreakdown {
  healthy: number;
  atRisk: number;
  churned: number;
  new: number;
}

export interface GrowthMetrics {
  newMerchantsThisMonth: number;
  merchantGrowthRate: number;
  gmvGrowthRate: number;
}

export interface TopMerchant {
  id: string;
  name: string;
  gmv: number;
  orders: number;
}

export interface DailyGmvData {
  date: string;
  gmv: number;
  orders: number;
  merchants: number;
}

export interface SalesChannelBreakdown {
  channel: string;
  gmv: number;
  orders: number;
  /** Percentage share of paid GMV, expressed on a 0-100 scale. */
  shareOfGmv: number;
  /** Percentage share of paid orders, expressed on a 0-100 scale. */
  shareOfOrders: number;
}

export interface MerchantActivationStage {
  key: string;
  label: string;
  merchants: number;
  /** Percentage of merchants in this stage, expressed on a 0-100 scale. */
  completionRate: number;
  description: string;
}

export interface BusinessTypeBreakdown {
  businessType: string;
  classification: 'configured' | 'invalid' | 'unspecified';
  label: string;
  merchants: number;
  rawValues: string[];
  shareOfMerchants: number;
}

export interface SignupSourceBreakdown {
  source: 'web' | 'ios' | 'android';
  merchants: number;
  shareOfMerchants: number;
}

export interface OrderStatusBreakdown {
  /** Raw status key from the order record. */
  status: string;
  /** Human-friendly status label for UI display. */
  label: string;
  /** Number of orders currently in this status. */
  orders: number;
  /** Gross order value in the admin display currency. */
  amount: number;
  /** Percentage of orders in this status, expressed on a 0-100 scale. */
  shareOfOrders: number;
  /** Percentage of gross order value in this status, expressed on a 0-100 scale. */
  shareOfAmount: number;
}

export interface PaymentMethodBreakdown {
  /** Raw payment method key from the order record. */
  method: string;
  /** Human-friendly method label for UI display. */
  label: string;
  /** Number of paid orders captured with this method. */
  orders: number;
  /** Paid GMV attributed to this method in the admin display currency. */
  amount: number;
  /** Percentage of paid orders for this method, expressed on a 0-100 scale. */
  shareOfPaidOrders: number;
  /** Percentage of paid GMV for this method, expressed on a 0-100 scale. */
  shareOfPaidAmount: number;
}

export interface PlatformAnalytics {
  summary: PlatformSummary;
  merchantHealth: MerchantHealthBreakdown;
  growth: GrowthMetrics;
  topMerchants: TopMerchant[];
  dailyGmv: DailyGmvData[];
  salesByChannel: SalesChannelBreakdown[];
  paymentStatuses: OrderStatusBreakdown[];
  shippingStatuses: OrderStatusBreakdown[];
  paymentMethods: PaymentMethodBreakdown[];
  merchantActivation: MerchantActivationStage[];
  businessTypes: BusinessTypeBreakdown[];
  signupSources: SignupSourceBreakdown[];
  generatedAt: string;
}
