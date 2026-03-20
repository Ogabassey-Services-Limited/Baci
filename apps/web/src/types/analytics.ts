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
  merchants: number;
  shareOfMerchants: number;
}

export interface SignupSourceBreakdown {
  source: 'web' | 'ios' | 'android';
  merchants: number;
  shareOfMerchants: number;
}

export interface PlatformAnalytics {
  summary: PlatformSummary;
  merchantHealth: MerchantHealthBreakdown;
  growth: GrowthMetrics;
  topMerchants: TopMerchant[];
  dailyGmv: DailyGmvData[];
  salesByChannel: SalesChannelBreakdown[];
  merchantActivation: MerchantActivationStage[];
  businessTypes: BusinessTypeBreakdown[];
  signupSources: SignupSourceBreakdown[];
  generatedAt: string;
}
