export interface PlatformSummary {
  totalGmv: number;
  gmvChange: number;
  activeMerchants: number;
  totalMerchants: number;
  totalOrders: number;
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

export interface PlatformAnalytics {
  summary: PlatformSummary;
  merchantHealth: MerchantHealthBreakdown;
  growth: GrowthMetrics;
  topMerchants: TopMerchant[];
  dailyGmv: DailyGmvData[];
  generatedAt: string;
}
