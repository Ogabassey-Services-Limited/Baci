'use client';

import {
  Activity,
  AlertTriangle,
  BarChart3,
  Check,
  Crown,
  DollarSign,
  MousePointerClick,
  Package,
  Percent,
  RefreshCcw,
  Settings2,
  Shield,
  ShoppingBag,
  Target,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { type Layout, Responsive, WidthProvider } from 'react-grid-layout';
import { BentoCard } from '@/components/ui/bento-card';
import { Button } from '@/components/ui/button';
import type { MerchantData } from '@/hooks/use-merchant';
import { getCountryByCode } from '@/lib/countries';
import { cn } from '@/lib/utils';
import { AIInsightsPanel } from './ai-insights-panel';
import type { AnalyticsCategory } from './analytics-category-nav';
import { RevenueChart, SalesByChannelChart } from './chart-components';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface MetricData {
  value: number;
  change: number;
}

interface AnalyticsSummary {
  revenue: MetricData;
  customers: MetricData;
  sales: MetricData;
  activeNow: MetricData;
  aov?: MetricData;
  profit?: MetricData;
  taxDue?: MetricData;
  grossMargin?: MetricData;
  revenuePerCustomer?: MetricData;
  refundRate?: MetricData;
  // New detailed metrics
  subtotal?: number;
  shipping?: number;
  tax?: number;
  discounts?: number;
  totalUnitsSold?: number;
}

interface SaleRecord {
  id: string;
  name: string;
  email: string;
  time: string;
  amount: number;
  avatar?: string;
}

interface ProductRecord {
  id: string;
  name: string;
  sku?: string;
  revenue: number;
  units?: number;
  sales?: number;
}

// ... other interfaces unchanged ...

export interface InventoryAlert {
  id: string;
  product_name: string;
  alert_type: string;
  current_stock: number;
  status: string;
}

export interface InventoryForecast {
  product_id: string;
  product_name: string;
  current_stock: number;
  avg_daily_sales: number;
  days_of_stock: number;
  sales_trend: string;
}

export interface SegmentInfo {
  segment: string;
  count: number;
  avg_clv?: number;
  avg_order_value?: number;
}

export interface SegmentSummary {
  total_customers: number;
  champions_count: number;
  at_risk_count: number;
  segments: SegmentInfo[];
}

export interface AdPlatformData {
  name: string;
  configured: boolean;
  conversions: number;
  revenue: number;
  clickAttributed: number;
}

export interface AdAnalyticsSummary {
  totalSpend: number;
  totalRoas: number;
  totalOrders: number;
  trackingRate: number;
  clickAttributionRate: number;
  lduRate: number;
  totalConversions: number;
  totalAttributedRevenue: number;
}

export interface AdAnalyticsDetails {
  ordersWithClickIds: number;
  ordersWithLDU: number;
}

export interface AdAnalyticsData {
  summary: AdAnalyticsSummary;
  details: AdAnalyticsDetails;
  platforms: AdPlatformData[];
  offlineConversionsEnabled: boolean;
  configuredPlatforms: number;
}

export interface AnalyticsData {
  summary?: AnalyticsSummary;
  chartData?: Array<{ date: string; revenue: number }>;
  revenueOverTime?: unknown[];
  salesByChannel?: Array<{ name: string; value: number }>;
  salesByPaymentMethod?: Array<{ name: string; value: number }>;
  recentSales?: SaleRecord[];
  topProducts?: ProductRecord[];
  paymentMethods?: Array<{ name: string; value: number }>;
  // Inventory data
  inventoryAlerts?: InventoryAlert[];
  inventoryForecasts?: InventoryForecast[];
  lowStockCount?: number;
  outOfStockCount?: number;
  // Segment data
  segmentSummary?: SegmentSummary;
  // Ad analytics data
  adAnalytics?: AdAnalyticsData;
}

interface Layouts {
  lg: Layout[];
  md: Layout[];
  [key: string]: Layout[];
}

interface DraggableAnalyticsGridProps {
  data: AnalyticsData;
  loading: boolean;
  activeCategory: AnalyticsCategory;
  merchant: MerchantData | null;
}

const DEFAULT_LAYOUTS: Layouts = {
  lg: [
    // Row 1: Primary KPIs (3 cards across -> w: 4)
    { i: 'summary-revenue', x: 0, y: 0, w: 4, h: 1 },
    { i: 'summary-orders', x: 4, y: 0, w: 4, h: 1 },
    { i: 'summary-profit', x: 8, y: 0, w: 4, h: 1 },

    // Row 2: Primary KPIs continued
    { i: 'summary-customers', x: 0, y: 1, w: 4, h: 1 },
    { i: 'summary-tax', x: 4, y: 1, w: 4, h: 1 },
    { i: 'summary-active', x: 8, y: 1, w: 4, h: 1 },

    // Row 3: Secondary KPIs (4 cards across -> w: 3)
    { i: 'summary-aov', x: 0, y: 2, w: 3, h: 1 },
    { i: 'summary-margin', x: 3, y: 2, w: 3, h: 1 },
    { i: 'summary-refund-rate', x: 6, y: 2, w: 3, h: 1 },
    { i: 'summary-revenue-per-customer', x: 9, y: 2, w: 3, h: 1 },

    // Row 4: Payment Methods (fits in 4 cols flow?)
    // Payment methods was w:4 h:2. Let's keep it similar or adapt.
    // In CSS grid secondary, payment methods was explicitly NOT in the secondary grid (lines 649-686).
    // It was in "Charts & Detailed Views Grid" (line 689) which is lg:grid-cols-3.
    // So Payment Methods is in a 3-col grid. w: 4 is correct for 12-col grid.

    // Row 4: Charts & Detailed Views (3 cols -> w: 4)
    { i: 'revenue-chart', x: 0, y: 3, w: 8, h: 3 }, // Spans 2 cols (2/3) -> w: 8
    { i: 'payment-methods', x: 8, y: 3, w: 4, h: 3 }, // Spans 1 col (1/3) -> w: 4

    // Row 5: Lists (stacked)
    { i: 'sales-channel', x: 0, y: 6, w: 6, h: 3 },
    { i: 'recent-sales', x: 6, y: 6, w: 6, h: 3 },
    { i: 'top-products', x: 0, y: 9, w: 12, h: 3 },

    // Inventory widgets
    { i: 'inventory-summary', x: 0, y: 0, w: 3, h: 1 },
    { i: 'inventory-alerts', x: 3, y: 0, w: 4, h: 2 },
    { i: 'inventory-forecast', x: 7, y: 0, w: 5, h: 3 },
    { i: 'low-stock-products', x: 0, y: 1, w: 3, h: 2 },

    // Segment widgets
    { i: 'segment-overview', x: 0, y: 0, w: 3, h: 2 },
    { i: 'segment-distribution', x: 3, y: 0, w: 3, h: 2 },
    { i: 'at-risk-customers', x: 6, y: 0, w: 3, h: 2 },
    { i: 'champions-list', x: 9, y: 0, w: 3, h: 2 },

    // Ad analytics widgets
    { i: 'ads-overview', x: 0, y: 0, w: 6, h: 2 },
    { i: 'ads-platforms', x: 6, y: 0, w: 6, h: 2 },
    { i: 'ads-attribution', x: 0, y: 2, w: 6, h: 2 },
    { i: 'ads-privacy', x: 6, y: 2, w: 6, h: 2 },
  ],
  md: [
    // On md (10 cols), make cards take full width or half width
    { i: 'sales-channel', x: 5, y: 0, w: 5, h: 3 },
    { i: 'summary-revenue', x: 0, y: 0, w: 5, h: 1 },
    { i: 'summary-orders', x: 5, y: 1, w: 5, h: 1 },
    { i: 'summary-profit', x: 5, y: 1, w: 5, h: 1 },
    { i: 'summary-customers', x: 0, y: 1, w: 5, h: 1 },
    { i: 'summary-tax', x: 0, y: 1, w: 5, h: 1 },
    { i: 'summary-active', x: 0, y: 2, w: 5, h: 1 },
    { i: 'summary-aov', x: 0, y: 2, w: 5, h: 1 },
    { i: 'summary-margin', x: 5, y: 2, w: 5, h: 1 },
    { i: 'summary-refund-rate', x: 5, y: 2, w: 5, h: 1 },
    { i: 'summary-revenue-per-customer', x: 0, y: 3, w: 5, h: 1 },
    { i: 'revenue-chart', x: 0, y: 4, w: 10, h: 3 },
    { i: 'payment-methods', x: 0, y: 7, w: 5, h: 3 },
    { i: 'recent-sales', x: 0, y: 10, w: 5, h: 3 },
    { i: 'top-products', x: 5, y: 10, w: 5, h: 3 },
    { i: 'inventory-alerts', x: 0, y: 0, w: 5, h: 2 },
    { i: 'inventory-forecast', x: 5, y: 0, w: 5, h: 3 },
    { i: 'inventory-summary', x: 0, y: 2, w: 5, h: 1 },
    { i: 'low-stock-products', x: 5, y: 3, w: 5, h: 2 },
    { i: 'segment-overview', x: 0, y: 0, w: 5, h: 2 },
    { i: 'segment-distribution', x: 5, y: 0, w: 5, h: 2 },
    { i: 'at-risk-customers', x: 0, y: 2, w: 5, h: 2 },
    { i: 'champions-list', x: 5, y: 2, w: 5, h: 2 },
    { i: 'ads-overview', x: 0, y: 0, w: 5, h: 2 },
    { i: 'ads-platforms', x: 5, y: 0, w: 5, h: 2 },
    { i: 'ads-attribution', x: 0, y: 2, w: 5, h: 2 },
    { i: 'ads-privacy', x: 5, y: 2, w: 5, h: 2 },
  ],
  sm: [
    // On sm (6 cols), stack in 2 columns
    { i: 'sales-channel', x: 0, y: 10, w: 6, h: 3 },
    { i: 'summary-revenue', x: 0, y: 0, w: 3, h: 1 },
    { i: 'summary-orders', x: 3, y: 0, w: 3, h: 1 },
    { i: 'summary-profit', x: 3, y: 0, w: 3, h: 1 },
    { i: 'summary-customers', x: 0, y: 1, w: 3, h: 1 },
    { i: 'summary-tax', x: 0, y: 1, w: 3, h: 1 },
    { i: 'summary-active', x: 3, y: 1, w: 3, h: 1 },
    { i: 'summary-aov', x: 3, y: 1, w: 3, h: 1 },
    { i: 'summary-margin', x: 0, y: 2, w: 3, h: 1 },
    { i: 'summary-refund-rate', x: 0, y: 2, w: 3, h: 1 },
    { i: 'summary-revenue-per-customer', x: 3, y: 2, w: 3, h: 1 },
    { i: 'revenue-chart', x: 0, y: 3, w: 6, h: 3 },
    { i: 'payment-methods', x: 0, y: 6, w: 6, h: 3 },
    { i: 'recent-sales', x: 0, y: 13, w: 6, h: 3 },
    { i: 'top-products', x: 0, y: 16, w: 6, h: 3 },
    { i: 'inventory-alerts', x: 0, y: 0, w: 3, h: 2 },
    { i: 'inventory-forecast', x: 3, y: 0, w: 3, h: 3 },
    { i: 'inventory-summary', x: 0, y: 2, w: 3, h: 1 },
    { i: 'low-stock-products', x: 0, y: 3, w: 6, h: 2 },
    { i: 'segment-overview', x: 0, y: 0, w: 3, h: 2 },
    { i: 'segment-distribution', x: 3, y: 0, w: 3, h: 2 },
    { i: 'at-risk-customers', x: 0, y: 2, w: 6, h: 2 },
    { i: 'champions-list', x: 0, y: 4, w: 6, h: 2 },
    { i: 'ads-overview', x: 0, y: 0, w: 6, h: 2 },
    { i: 'ads-platforms', x: 0, y: 2, w: 6, h: 2 },
    { i: 'ads-attribution', x: 0, y: 4, w: 6, h: 2 },
    { i: 'ads-privacy', x: 0, y: 6, w: 6, h: 2 },
  ],
  xs: [
    // On xs (4 cols), cards take 2 or 4 cols
    { i: 'sales-channel', x: 0, y: 10, w: 4, h: 3 },
    { i: 'summary-revenue', x: 0, y: 0, w: 2, h: 1 },
    { i: 'summary-orders', x: 2, y: 0, w: 2, h: 1 },
    { i: 'summary-profit', x: 2, y: 0, w: 2, h: 1 },
    { i: 'summary-customers', x: 0, y: 1, w: 2, h: 1 },
    { i: 'summary-tax', x: 0, y: 1, w: 2, h: 1 },
    { i: 'summary-active', x: 2, y: 1, w: 2, h: 1 },
    { i: 'summary-aov', x: 2, y: 1, w: 2, h: 1 },
    { i: 'summary-margin', x: 0, y: 2, w: 2, h: 1 },
    { i: 'summary-refund-rate', x: 0, y: 2, w: 2, h: 1 },
    { i: 'summary-revenue-per-customer', x: 2, y: 2, w: 2, h: 1 },
    { i: 'revenue-chart', x: 0, y: 3, w: 4, h: 3 },
    { i: 'payment-methods', x: 0, y: 6, w: 4, h: 3 },
    { i: 'recent-sales', x: 0, y: 13, w: 4, h: 3 },
    { i: 'top-products', x: 0, y: 16, w: 4, h: 3 },
    { i: 'inventory-alerts', x: 0, y: 0, w: 2, h: 2 },
    { i: 'inventory-forecast', x: 2, y: 0, w: 2, h: 3 },
    { i: 'inventory-summary', x: 0, y: 2, w: 2, h: 1 },
    { i: 'low-stock-products', x: 0, y: 3, w: 4, h: 2 },
    { i: 'segment-overview', x: 0, y: 0, w: 2, h: 2 },
    { i: 'segment-distribution', x: 2, y: 0, w: 2, h: 2 },
    { i: 'at-risk-customers', x: 0, y: 2, w: 4, h: 2 },
    { i: 'champions-list', x: 0, y: 4, w: 4, h: 2 },
    { i: 'ads-overview', x: 0, y: 0, w: 4, h: 2 },
    { i: 'ads-platforms', x: 0, y: 2, w: 4, h: 2 },
    { i: 'ads-attribution', x: 0, y: 4, w: 4, h: 2 },
    { i: 'ads-privacy', x: 0, y: 6, w: 4, h: 2 },
  ],
  xxs: [
    // On xxs (2 cols), everything full width
    { i: 'sales-channel', x: 0, y: 10, w: 2, h: 3 },
    { i: 'summary-revenue', x: 0, y: 0, w: 2, h: 1 },
    { i: 'summary-orders', x: 0, y: 1, w: 2, h: 1 },
    { i: 'summary-profit', x: 0, y: 1, w: 2, h: 1 },
    { i: 'summary-customers', x: 0, y: 2, w: 2, h: 1 },
    { i: 'summary-tax', x: 0, y: 2, w: 2, h: 1 },
    { i: 'summary-active', x: 0, y: 3, w: 2, h: 1 },
    { i: 'summary-aov', x: 0, y: 3, w: 2, h: 1 },
    { i: 'summary-margin', x: 0, y: 4, w: 2, h: 1 },
    { i: 'summary-refund-rate', x: 0, y: 4, w: 2, h: 1 },
    { i: 'summary-revenue-per-customer', x: 0, y: 5, w: 2, h: 1 },
    { i: 'revenue-chart', x: 0, y: 6, w: 2, h: 3 },
    { i: 'payment-methods', x: 0, y: 9, w: 2, h: 3 },
    { i: 'recent-sales', x: 0, y: 13, w: 2, h: 3 },
    { i: 'top-products', x: 0, y: 16, w: 2, h: 3 },
    { i: 'inventory-alerts', x: 0, y: 0, w: 2, h: 2 },
    { i: 'inventory-forecast', x: 0, y: 2, w: 2, h: 3 },
    { i: 'inventory-summary', x: 0, y: 5, w: 2, h: 1 },
    { i: 'low-stock-products', x: 0, y: 6, w: 2, h: 2 },
    { i: 'segment-overview', x: 0, y: 0, w: 2, h: 2 },
    { i: 'segment-distribution', x: 0, y: 2, w: 2, h: 2 },
    { i: 'at-risk-customers', x: 0, y: 4, w: 2, h: 2 },
    { i: 'champions-list', x: 0, y: 6, w: 2, h: 2 },
    { i: 'ads-overview', x: 0, y: 0, w: 2, h: 2 },
    { i: 'ads-platforms', x: 0, y: 2, w: 2, h: 2 },
    { i: 'ads-attribution', x: 0, y: 4, w: 2, h: 2 },
    { i: 'ads-privacy', x: 0, y: 6, w: 2, h: 2 },
  ],
};

const CATEGORY_LAYOUTS: Record<string, Layouts> = {
  products: {
    lg: [
      { i: 'summary-orders', x: 0, y: 0, w: 3, h: 1 },
      { i: 'summary-refund-rate', x: 3, y: 0, w: 3, h: 1 },
      { i: 'top-products', x: 6, y: 0, w: 6, h: 4 },
    ],
    md: [
      { i: 'summary-orders', x: 0, y: 0, w: 5, h: 1 },
      { i: 'summary-refund-rate', x: 5, y: 0, w: 5, h: 1 },
      { i: 'top-products', x: 0, y: 1, w: 10, h: 4 },
    ],
    sm: [
      { i: 'summary-orders', x: 0, y: 0, w: 3, h: 1 },
      { i: 'summary-refund-rate', x: 3, y: 0, w: 3, h: 1 },
      { i: 'top-products', x: 0, y: 1, w: 6, h: 4 },
    ],
    xs: [
      { i: 'summary-orders', x: 0, y: 0, w: 2, h: 1 },
      { i: 'summary-refund-rate', x: 2, y: 0, w: 2, h: 1 },
      { i: 'top-products', x: 0, y: 1, w: 4, h: 4 },
    ],
    xxs: [
      { i: 'summary-orders', x: 0, y: 0, w: 2, h: 1 },
      { i: 'summary-refund-rate', x: 0, y: 1, w: 2, h: 1 },
      { i: 'top-products', x: 0, y: 2, w: 2, h: 4 },
    ],
  },
  customers: {
    lg: [
      { i: 'summary-customers', x: 0, y: 0, w: 3, h: 1 },
      { i: 'summary-active', x: 3, y: 0, w: 3, h: 1 },
    ],
    md: [
      { i: 'summary-customers', x: 0, y: 0, w: 5, h: 1 },
      { i: 'summary-active', x: 5, y: 0, w: 5, h: 1 },
    ],
    sm: [
      { i: 'summary-customers', x: 0, y: 0, w: 3, h: 1 },
      { i: 'summary-active', x: 3, y: 0, w: 3, h: 1 },
    ],
    xs: [
      { i: 'summary-customers', x: 0, y: 0, w: 2, h: 1 },
      { i: 'summary-active', x: 2, y: 0, w: 2, h: 1 },
    ],
    xxs: [
      { i: 'summary-customers', x: 0, y: 0, w: 2, h: 1 },
      { i: 'summary-active', x: 0, y: 1, w: 2, h: 1 },
    ],
  },
  ads: {
    lg: [
      { i: 'ads-overview', x: 0, y: 0, w: 6, h: 2 },
      { i: 'ads-platforms', x: 6, y: 0, w: 6, h: 2 },
      { i: 'ads-attribution', x: 0, y: 2, w: 6, h: 2 },
      { i: 'ads-privacy', x: 6, y: 2, w: 6, h: 2 },
    ],
    md: [
      { i: 'ads-overview', x: 0, y: 0, w: 5, h: 2 },
      { i: 'ads-platforms', x: 5, y: 0, w: 5, h: 2 },
      { i: 'ads-attribution', x: 0, y: 2, w: 5, h: 2 },
      { i: 'ads-privacy', x: 5, y: 2, w: 5, h: 2 },
    ],
    sm: [
      { i: 'ads-overview', x: 0, y: 0, w: 6, h: 2 },
      { i: 'ads-platforms', x: 0, y: 2, w: 6, h: 2 },
      { i: 'ads-attribution', x: 0, y: 4, w: 6, h: 2 },
      { i: 'ads-privacy', x: 0, y: 6, w: 6, h: 2 },
    ],
    xs: [
      { i: 'ads-overview', x: 0, y: 0, w: 4, h: 2 },
      { i: 'ads-platforms', x: 0, y: 2, w: 4, h: 2 },
      { i: 'ads-attribution', x: 0, y: 4, w: 4, h: 2 },
      { i: 'ads-privacy', x: 0, y: 6, w: 4, h: 2 },
    ],
    xxs: [
      { i: 'ads-overview', x: 0, y: 0, w: 2, h: 2 },
      { i: 'ads-platforms', x: 0, y: 2, w: 2, h: 2 },
      { i: 'ads-attribution', x: 0, y: 4, w: 2, h: 2 },
      { i: 'ads-privacy', x: 0, y: 6, w: 2, h: 2 },
    ],
  },
};

export function DraggableAnalyticsGrid({
  data,
  loading,
  activeCategory,
  merchant,
}: DraggableAnalyticsGridProps) {
  const [isEditMode, setIsEditMode] = useState(false);

  // Dynamically load grid layout CSS to avoid render-blocking
  useEffect(() => {
    import('react-grid-layout/css/styles.css');
    import('react-resizable/css/styles.css');
  }, []);

  const [layouts, setLayouts] = useState<Layouts>(DEFAULT_LAYOUTS);

  useEffect(() => {
    if (CATEGORY_LAYOUTS[activeCategory]) {
      setLayouts(CATEGORY_LAYOUTS[activeCategory]);
    } else {
      setLayouts(DEFAULT_LAYOUTS);
    }
  }, [activeCategory]);

  // Save layout change
  const onLayoutChange = (currentLayout: Layout[], allLayouts: Layouts) => {
    setLayouts(allLayouts);
    if (!isEditMode) return; // Only save if in edit mode (optional, but good for performance)

    // Fire-and-forget pattern for saving layout preferences
    fetch('/api/dashboard/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layout_config: currentLayout }),
    }).catch((error) => {
      console.error('Failed to save layout:', error);
    });
  };

  const atRiskSegment = data?.segmentSummary?.segments?.find(
    (s) => s.segment === 'At Risk'
  );

  const championsSegment = data?.segmentSummary?.segments?.find(
    (s) => s.segment === 'Champions'
  );

  if (loading) {
    return (
      <div className="space-y-4">
        {/* AI Insights skeleton - already handled by AIInsightsPanel */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0 w-full">
            <AIInsightsPanel activeCategory={activeCategory} />
          </div>
        </div>
        {/* Grid skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: Skeleton
              key={i}
              className="h-32 bg-muted/10 rounded-2xl border border-border/50 overflow-hidden relative"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
              <div className="p-4 space-y-2">
                <div className="h-3 w-20 bg-muted/30 rounded" />
                <div className="h-6 w-24 bg-muted/20 rounded" />
              </div>
            </div>
          ))}
          <div className="col-span-1 md:col-span-3 h-80 bg-muted/10 rounded-2xl border border-border/50 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
            <div className="p-4">
              <div className="h-4 w-32 bg-muted/30 rounded mb-4" />
              <div className="h-full w-full flex items-end gap-2 pb-8">
                {[40, 65, 45, 80, 55, 70].map((h, i) => (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: Skeleton
                    key={i}
                    className="flex-1 bg-muted/20 rounded-t"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="col-span-1 h-80 bg-muted/10 rounded-2xl border border-border/50 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
          </div>
        </div>
      </div>
    );
  }

  const {
    chartData: _chartData,
    recentSales: _recentSales,
    topProducts: _topProducts,
    salesByChannel: _salesByChannel,
  } = data || {};

  // Filter widgets based on active category
  const isWidgetVisible = (key: string) => {
    // Overview shows all standard widgets but not specialized inventory/segment/ads widgets
    if (activeCategory === 'overview') {
      const specializedWidgets = [
        'inventory-alerts',
        'inventory-forecast',
        'inventory-summary',
        'low-stock-products',
        'segment-overview',
        'segment-distribution',
        'at-risk-customers',
        'champions-list',
        'ads-overview',
        'ads-platforms',
        'ads-attribution',
        'ads-privacy',
      ];
      return !specializedWidgets.includes(key);
    }

    const categoryMap: Record<string, string[]> = {
      finance: [
        'summary-revenue',
        'revenue-chart',
        'recent-sales',
        'summary-profit',
        'summary-tax',
        'payment-methods',
        'summary-aov',
        'summary-margin',
        'summary-revenue-per-customer',
        'financial-summary',
      ],
      products: [
        'summary-orders',
        'top-products',
        'summary-refund-rate',
        'summary-units',
      ],
      customers: ['summary-customers', 'summary-active'],
      marketing: ['sales-channel'],
      inventory: [
        'inventory-alerts',
        'inventory-forecast',
        'inventory-summary',
        'low-stock-products',
      ],
      segments: [
        'segment-overview',
        'segment-distribution',
        'at-risk-customers',
        'champions-list',
      ],
      ads: ['ads-overview', 'ads-platforms', 'ads-attribution', 'ads-privacy'],
    };

    return categoryMap[activeCategory]?.includes(key);
  };

  const summary = data?.summary || {
    revenue: { value: 0, change: 0 },
    customers: { value: 0, change: 0 },
    sales: { value: 0, change: 0 },
    activeNow: { value: 0, change: 0 },
    aov: { value: 0, change: 0 },
    profit: { value: 0, change: 0 },
    taxDue: { value: 0, change: 0 },
    grossMargin: { value: 0, change: 0 },
    revenuePerCustomer: { value: 0, change: 0 },
    refundRate: { value: 0, change: 0 },
  };

  const formatCurrency = (value: number) => {
    const country = merchant?.country
      ? getCountryByCode(merchant.country)
      : undefined;
    const locale = country ? `en-${country.code}` : 'en-US';
    const currency = country ? country.currency : 'USD';

    // Use compact notation for large numbers to prevent overflow
    const useCompact = value >= 100000;
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      currencyDisplay: 'symbol',
      notation: useCompact ? 'compact' : 'standard',
      maximumFractionDigits: useCompact ? 1 : 2,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value / 100);
  };

  // Helper to render metric cards using BentoCard
  const renderMetricCard = (
    key: string,
    title: string,
    value: string,
    change: number,
    icon: React.ElementType,
    trend: 'up' | 'down'
  ) => (
    <div key={key} className="min-w-0">
      <BentoCard
        title={title}
        icon={icon}
        className="h-full"
        action={
          <div
            className={cn(
              'flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full w-fit shrink-0',
              trend === 'up'
                ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                : 'bg-red-500/10 text-red-600 dark:text-red-400'
            )}
          >
            <span>
              {change >= 0 ? '+' : ''}
              {change}%
            </span>
          </div>
        }
      >
        <div className="space-y-1 min-w-0">
          <div
            className="text-xl sm:text-2xl font-bold tracking-tight truncate"
            title={value}
          >
            {value}
          </div>
        </div>
      </BentoCard>
    </div>
  );

  const { chartData, recentSales, topProducts, salesByChannel } = data || {};

  if (!isEditMode) {
    // VIEW MODE: Use native CSS Grid for perfect responsiveness
    return (
      <div className="w-full max-w-full overflow-hidden space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0 w-full">
            <AIInsightsPanel activeCategory={activeCategory} />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditMode(true)}
            className="gap-2 flex-shrink-0"
            aria-label="Customize Dashboard Layout"
          >
            <Settings2 className="w-4 h-4" />
            Customize Dashboard
          </Button>
        </div>

        {/* Primary Stats Grid - 3 columns on large screens, 2 on medium, 1 on small */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {isWidgetVisible('summary-revenue') &&
            renderMetricCard(
              'summary-revenue',
              'Total Revenue 💰',
              formatCurrency(summary.revenue.value),
              summary.revenue.change,
              DollarSign,
              summary.revenue.change >= 0 ? 'up' : 'down'
            )}
          {isWidgetVisible('summary-orders') &&
            renderMetricCard(
              'summary-orders',
              'Total Orders 📦',
              summary.sales.value.toString(),
              summary.sales.change,
              ShoppingBag,
              'up'
            )}
          {isWidgetVisible('summary-profit') &&
            renderMetricCard(
              'summary-profit',
              'Net Profit 📈',
              formatCurrency(summary.profit?.value || 0),
              summary.profit?.change || 0,
              DollarSign,
              (summary.profit?.change || 0) >= 0 ? 'up' : 'down'
            )}
          {isWidgetVisible('summary-customers') &&
            renderMetricCard(
              'summary-customers',
              'Customers 👥',
              summary.customers.value.toString(),
              summary.customers.change,
              Users,
              'up'
            )}
          {isWidgetVisible('summary-tax') &&
            renderMetricCard(
              'summary-tax',
              'Tax Due 🏛️',
              formatCurrency(summary.taxDue?.value || 0),
              summary.taxDue?.change || 0,
              DollarSign,
              // Tax is a cash-flow cost from the merchant's POV, so a period
              // with *lower* tax owed is displayed as the "up" (positive)
              // direction even though the change value itself went down.
              (summary.taxDue?.change || 0) <= 0 ? 'up' : 'down'
            )}
          {isWidgetVisible('summary-active') &&
            renderMetricCard(
              'summary-active',
              'Active Now 🟢',
              summary.activeNow.value.toString(),
              summary.activeNow.change,
              Activity,
              'up'
            )}
        </div>

        {/* Secondary Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {isWidgetVisible('summary-aov') &&
            renderMetricCard(
              'summary-aov',
              'Avg. Order Value 🛒',
              formatCurrency(summary.aov?.value || 0),
              summary.aov?.change || 0,
              DollarSign,
              (summary.aov?.change || 0) >= 0 ? 'up' : 'down'
            )}
          {isWidgetVisible('summary-margin') &&
            renderMetricCard(
              'summary-margin',
              'Gross Margin % 📊',
              formatPercent(summary.grossMargin?.value || 0),
              summary.grossMargin?.change || 0,
              Percent,
              (summary.grossMargin?.change || 0) >= 0 ? 'up' : 'down'
            )}
          {isWidgetVisible('summary-refund-rate') &&
            renderMetricCard(
              'summary-refund-rate',
              'Refund Rate ↩️',
              formatPercent(summary.refundRate?.value || 0),
              summary.refundRate?.change || 0,
              RefreshCcw,
              (summary.refundRate?.change || 0) <= 0 ? 'up' : 'down'
            )}
          {isWidgetVisible('summary-revenue-per-customer') &&
            renderMetricCard(
              'summary-revenue-per-customer',
              'Revenue / Customer 💎',
              formatCurrency(summary.revenuePerCustomer?.value || 0),
              summary.revenuePerCustomer?.change || 0,
              Users,
              (summary.revenuePerCustomer?.change || 0) >= 0 ? 'up' : 'down'
            )}
          {isWidgetVisible('summary-units') &&
            renderMetricCard(
              'summary-units',
              'Units Sold 🛒',
              (summary.totalUnitsSold || 0).toString(),
              0,
              Package,
              'up'
            )}
        </div>

        {/* Charts & Detailed Views Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Revenue Chart - Spans 2 columns on lg */}
          {isWidgetVisible('revenue-chart') && (
            <div className="lg:col-span-2 min-h-[400px]">
              <BentoCard title="Revenue Over Time" className="h-full">
                <RevenueChart data={chartData || []} />
              </BentoCard>
            </div>
          )}

          {/* Payment Methods - Spans 1 column */}
          {isWidgetVisible('payment-methods') && (
            <div className="min-h-[400px]">
              <BentoCard title="Payment Methods 💳" className="h-full">
                <div className="space-y-4">
                  {data.salesByPaymentMethod &&
                  data.salesByPaymentMethod.length > 0 ? (
                    data.salesByPaymentMethod.map((pm, idx) => {
                      const totalValue =
                        data.salesByPaymentMethod?.reduce(
                          (acc, curr) => acc + curr.value,
                          0
                        ) || 1;
                      const percentage = Math.round(
                        (pm.value / totalValue) * 100
                      );
                      const colors = [
                        'bg-primary',
                        'bg-blue-500',
                        'bg-purple-500',
                        'bg-amber-500',
                        'bg-slate-500',
                      ];

                      return (
                        <div key={pm.name} className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>{pm.name}</span>
                            <span className="font-medium">{percentage}%</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn(
                                'h-full',
                                colors[idx % colors.length]
                              )}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground italic text-sm">
                      No payment data available
                    </div>
                  )}
                </div>
              </BentoCard>
            </div>
          )}
        </div>

        {/* Financial Summary Board */}
        {isWidgetVisible('financial-summary') && (
          <div className="w-full">
            <BentoCard title="Financial Position 🏦" className="h-full">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-4 bg-slate-900 rounded-2xl text-white">
                <div className="space-y-1">
                  <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">
                    Subtotal
                  </p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(summary.subtotal || 0)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">
                    Shipping
                  </p>
                  <p className="text-2xl font-bold text-blue-400">
                    {formatCurrency(summary.shipping || 0)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">
                    Tax (VAT)
                  </p>
                  <p className="text-2xl font-bold text-purple-400">
                    {formatCurrency(summary.tax || 0)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">
                    Discounts
                  </p>
                  <p className="text-2xl font-bold text-red-400">
                    -{formatCurrency(summary.discounts || 0)}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex justify-between items-center p-4 border-t border-border/50">
                <span className="text-lg font-bold">Net Sales</span>
                <span className="text-2xl font-black text-primary">
                  {formatCurrency(summary.revenue.value)}
                </span>
              </div>
            </BentoCard>
          </div>
        )}

        {/* Bottom Lists Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {isWidgetVisible('sales-channel') && (
            <div className="min-h-[350px]">
              <BentoCard title="Sales by Channel 📊" className="h-full">
                <SalesByChannelChart data={salesByChannel || []} />
              </BentoCard>
            </div>
          )}

          {isWidgetVisible('recent-sales') && (
            <div className="min-h-[350px]">
              <BentoCard title="Recent Sales 🛍️" className="h-full">
                <div className="space-y-4 custom-scrollbar overflow-y-auto max-h-[250px] pr-2">
                  {recentSales?.map((sale) => (
                    <div
                      key={sale.id}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-primary">
                            {sale.name.charAt(0)}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">
                            {sale.name}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {sale.email}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold">
                          {formatCurrency(sale.amount)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {sale.time}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </BentoCard>
            </div>
          )}
        </div>

        {/* Top Products - Full Width */}
        {isWidgetVisible('top-products') && (
          <div className="w-full">
            <BentoCard title="Top Products 🔥" className="h-full">
              <div className="space-y-4 custom-scrollbar overflow-y-auto max-h-[250px] pr-2">
                {topProducts?.map((product, i) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-secondary-foreground">
                          #{i + 1}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">
                          {product.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {product.sales} sales
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold">
                        {formatCurrency(product.revenue)}
                      </div>
                      {(product.units ?? 0) > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {product.units} units
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </BentoCard>
          </div>
        )}

        {/* Ad Analytics Widgets */}
        {activeCategory === 'ads' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full">
            {/* Ads Overview */}
            {isWidgetVisible('ads-overview') && (
              <div className="min-h-[300px]">
                <BentoCard
                  title="Conversion Overview"
                  icon={Zap}
                  className="h-full"
                >
                  {data?.adAnalytics ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10">
                        <div>
                          <p className="text-sm text-muted-foreground">
                            Total Conversions Tracked
                          </p>
                          <p className="text-3xl font-bold">
                            {data.adAnalytics.summary.totalConversions}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">
                            Attributed Revenue
                          </p>
                          <p className="text-xl font-bold text-green-500">
                            {formatCurrency(
                              data.adAnalytics.summary.totalAttributedRevenue
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-muted/30 text-center">
                          <div className="text-2xl font-bold">
                            {data.adAnalytics.configuredPlatforms}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Platforms Active
                          </div>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/30 text-center">
                          <div className="text-2xl font-bold">
                            {data.adAnalytics.summary.totalOrders}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Total Orders
                          </div>
                        </div>
                      </div>
                      <div
                        className={cn(
                          'flex items-center gap-2 p-2 rounded-lg text-sm',
                          data.adAnalytics.offlineConversionsEnabled
                            ? 'bg-green-500/10 text-green-600'
                            : 'bg-amber-500/10 text-amber-600'
                        )}
                      >
                        {data.adAnalytics.offlineConversionsEnabled ? (
                          <>
                            <Check className="w-4 h-4" />
                            <span>Offline conversions enabled</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-4 h-4" />
                            <span>Offline conversions disabled</span>
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-muted-foreground">Loading...</p>
                    </div>
                  )}
                </BentoCard>
              </div>
            )}

            {/* Platform Breakdown */}
            {isWidgetVisible('ads-platforms') && (
              <div className="min-h-[300px]">
                <BentoCard
                  title="Platform Performance"
                  icon={BarChart3}
                  className="h-full"
                >
                  {data?.adAnalytics ? (
                    <div className="space-y-3">
                      {data.adAnalytics.platforms.map((platform) => (
                        <div
                          key={platform.name}
                          className={cn(
                            'p-3 rounded-lg',
                            platform.configured
                              ? 'bg-muted/30'
                              : 'bg-muted/10 opacity-60'
                          )}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {platform.name}
                              </span>
                              {platform.configured ? (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-600">
                                  Active
                                </span>
                              ) : (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                                  Not configured
                                </span>
                              )}
                            </div>
                            <span className="text-sm font-bold">
                              {platform.conversions} conversions
                            </span>
                          </div>
                          {platform.configured && (
                            <div className="flex justify-between text-sm text-muted-foreground">
                              <span>
                                Revenue: {formatCurrency(platform.revenue)}
                              </span>
                              <span>
                                {platform.clickAttributed} click-attributed
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-muted-foreground">Loading...</p>
                    </div>
                  )}
                </BentoCard>
              </div>
            )}

            {/* Click Attribution */}
            {isWidgetVisible('ads-attribution') && (
              <div className="min-h-[250px]">
                <BentoCard
                  title="Click Attribution"
                  icon={MousePointerClick}
                  className="h-full"
                >
                  {data?.adAnalytics ? (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Orders tracked with ad click IDs for better attribution
                      </p>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 rounded-lg bg-blue-500/10 text-center">
                          <div className="text-xl font-bold text-blue-600">
                            {data.adAnalytics.summary.trackingRate}%
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Tracking Rate
                          </div>
                        </div>
                        <div className="p-3 rounded-lg bg-purple-500/10 text-center">
                          <div className="text-xl font-bold text-purple-600">
                            {data.adAnalytics.summary.clickAttributionRate}%
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Click Attribution
                          </div>
                        </div>
                        <div className="p-3 rounded-lg bg-green-500/10 text-center">
                          <div className="text-xl font-bold text-green-600">
                            {data.adAnalytics.details.ordersWithClickIds}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            With Click IDs
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-4">
                        Click IDs (fbclid, ttclid, gclid, sccid) help platforms
                        attribute conversions to the original ad click for
                        better ROAS measurement.
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-muted-foreground">Loading...</p>
                    </div>
                  )}
                </BentoCard>
              </div>
            )}

            {/* Privacy Compliance */}
            {isWidgetVisible('ads-privacy') && (
              <div className="min-h-[250px]">
                <BentoCard
                  title="Privacy Compliance"
                  icon={Shield}
                  className="h-full"
                >
                  {data?.adAnalytics ? (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        CCPA/GDPR compliance through Limited Data Use (LDU)
                      </p>
                      <div className="p-4 rounded-lg bg-muted/30">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Orders with LDU flag</span>
                          <span className="text-lg font-bold">
                            {data.adAnalytics.details.ordersWithLDU}
                          </span>
                        </div>
                        <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-500 transition-all"
                            style={{
                              width: `${Math.min(data.adAnalytics.summary.lduRate, 100)}%`,
                            }}
                          />
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {data.adAnalytics.summary.lduRate}% of tracked orders
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        LDU is automatically applied for users in California
                        (CCPA), EU countries (GDPR), and other privacy-focused
                        regions.
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-muted-foreground">Loading...</p>
                    </div>
                  )}
                </BentoCard>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // EDIT MODE: Use ReactGridLayout for drag-and-drop customization
  return (
    <div className="w-full">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
        <div className="flex-1 min-w-0 w-full">
          <AIInsightsPanel activeCategory={activeCategory} />
        </div>
        <Button
          variant="default"
          size="sm"
          onClick={() => setIsEditMode(false)}
          className="gap-2 flex-shrink-0"
          aria-label="Save Dashboard Layout"
        >
          <Check className="w-4 h-4" />
          Save Layout
        </Button>
      </div>

      <div className="w-full max-w-full overflow-hidden">
        <ResponsiveGridLayout
          className="layout w-full"
          layouts={layouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={150}
          onLayoutChange={onLayoutChange}
          isDraggable={isEditMode}
          isResizable={isEditMode}
          draggableHandle=".drag-handle"
          margin={[16, 16]}
        >
          {isWidgetVisible('summary-revenue') &&
            renderMetricCard(
              'summary-revenue',
              'Total Revenue 💰',
              formatCurrency(summary.revenue.value),
              summary.revenue.change,
              DollarSign,
              summary.revenue.change >= 0 ? 'up' : 'down'
            )}
          {isWidgetVisible('summary-aov') &&
            renderMetricCard(
              'summary-aov',
              'Avg. Order Value 🛒',
              formatCurrency(summary.aov?.value || 0),
              summary.aov?.change || 0,
              DollarSign,
              (summary.aov?.change || 0) >= 0 ? 'up' : 'down'
            )}
          {isWidgetVisible('summary-margin') &&
            renderMetricCard(
              'summary-margin',
              'Gross Margin % 📊',
              formatPercent(summary.grossMargin?.value || 0),
              summary.grossMargin?.change || 0,
              Percent,
              (summary.grossMargin?.change || 0) >= 0 ? 'up' : 'down'
            )}
          {isWidgetVisible('summary-revenue-per-customer') &&
            renderMetricCard(
              'summary-revenue-per-customer',
              'Revenue / Customer 💎',
              formatCurrency(summary.revenuePerCustomer?.value || 0),
              summary.revenuePerCustomer?.change || 0,
              Users,
              (summary.revenuePerCustomer?.change || 0) >= 0 ? 'up' : 'down'
            )}
          {isWidgetVisible('summary-profit') &&
            renderMetricCard(
              'summary-profit',
              'Net Profit 📈',
              formatCurrency(summary.profit?.value || 0),
              summary.profit?.change || 0,
              DollarSign,
              (summary.profit?.change || 0) >= 0 ? 'up' : 'down'
            )}
          {isWidgetVisible('summary-tax') &&
            renderMetricCard(
              'summary-tax',
              'Tax Due 🏛️',
              formatCurrency(summary.taxDue?.value || 0),
              summary.taxDue?.change || 0,
              DollarSign,
              // Tax is a cash-flow cost from the merchant's POV, so a period
              // with *lower* tax owed is displayed as the "up" (positive)
              // direction even though the change value itself went down.
              (summary.taxDue?.change || 0) <= 0 ? 'up' : 'down'
            )}

          {isWidgetVisible('payment-methods') && (
            <div key="payment-methods">
              <BentoCard title="Payment Methods 💳" className="h-full">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Credit Card</span>
                      <span className="font-medium">65%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary w-[65%]" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>PayPal</span>
                      <span className="font-medium">35%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 w-[35%]" />
                    </div>
                  </div>
                </div>
              </BentoCard>
            </div>
          )}

          {isWidgetVisible('summary-customers') &&
            renderMetricCard(
              'summary-customers',
              'Customers 👥',
              summary.customers.value.toString(),
              summary.customers.change,
              Users,
              'up'
            )}
          {isWidgetVisible('summary-orders') &&
            renderMetricCard(
              'summary-orders',
              'Total Orders 📦',
              summary.sales.value.toString(),
              summary.sales.change,
              ShoppingBag,
              'up'
            )}
          {isWidgetVisible('summary-refund-rate') &&
            renderMetricCard(
              'summary-refund-rate',
              'Refund Rate ↩️',
              formatPercent(summary.refundRate?.value || 0),
              summary.refundRate?.change || 0,
              RefreshCcw,
              (summary.refundRate?.change || 0) <= 0 ? 'up' : 'down'
            )}
          {isWidgetVisible('summary-active') &&
            renderMetricCard(
              'summary-active',
              'Active Now 🟢',
              summary.activeNow.value.toString(),
              summary.activeNow.change,
              Activity,
              'up'
            )}

          {isWidgetVisible('revenue-chart') && (
            <div key="revenue-chart">
              <BentoCard title="Revenue Over Time" className="h-full">
                <RevenueChart data={data?.chartData || []} />
              </BentoCard>
            </div>
          )}
          {isWidgetVisible('recent-sales') && (
            <div key="recent-sales">
              <BentoCard title="Recent Sales" className="h-full">
                <div className="space-y-4 custom-scrollbar overflow-y-auto max-h-[250px] pr-2">
                  {data?.recentSales?.map((sale) => (
                    <div
                      key={sale.id}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-white/50 dark:hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {sale.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{sale.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {sale.email}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm font-medium">
                        {formatCurrency(sale.amount)}
                      </p>
                    </div>
                  ))}
                </div>
              </BentoCard>
            </div>
          )}
          {isWidgetVisible('sales-channel') && (
            <div key="sales-channel">
              <BentoCard title="Sales by Channel 📊" className="h-full">
                <SalesByChannelChart data={data?.salesByChannel || []} />
              </BentoCard>
            </div>
          )}
          {isWidgetVisible('top-products') && (
            <div key="top-products">
              <BentoCard title="Top Products 🏆" className="h-full">
                <div className="space-y-4 custom-scrollbar overflow-y-auto max-h-[250px] pr-2">
                  {data?.topProducts?.map((product, index) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-white/50 dark:hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                          #{index + 1}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{product.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {product.sales ?? 0} sales
                          </p>
                        </div>
                      </div>
                      <p className="text-sm font-medium">
                        {formatCurrency(product.revenue)}
                      </p>
                    </div>
                  ))}
                </div>
              </BentoCard>
            </div>
          )}

          {/* Inventory Widgets */}
          {isWidgetVisible('inventory-summary') && (
            <div key="inventory-summary">
              <BentoCard
                title="Inventory Health"
                icon={Package}
                className="h-full"
              >
                <div className="flex items-center justify-between">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-500">
                      {data?.outOfStockCount || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Out of Stock
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-amber-500">
                      {data?.lowStockCount || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Low Stock
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-500">
                      {data?.inventoryAlerts?.filter(
                        (a) => a.status === 'resolved'
                      ).length || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Resolved
                    </div>
                  </div>
                </div>
              </BentoCard>
            </div>
          )}

          {isWidgetVisible('inventory-alerts') && (
            <div key="inventory-alerts">
              <BentoCard
                title="Stock Alerts"
                icon={AlertTriangle}
                className="h-full"
              >
                <div className="space-y-3 custom-scrollbar overflow-y-auto max-h-[200px] pr-2">
                  {(data?.inventoryAlerts || []).length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No active alerts</p>
                    </div>
                  ) : (
                    data?.inventoryAlerts?.slice(0, 5).map((alert) => (
                      <div
                        key={alert.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              'w-2 h-2 rounded-full',
                              alert.alert_type === 'out_of_stock'
                                ? 'bg-red-500'
                                : alert.alert_type === 'low_stock'
                                  ? 'bg-amber-500'
                                  : 'bg-blue-500'
                            )}
                          />
                          <div>
                            <p className="text-sm font-medium">
                              {alert.product_name || 'Unknown Product'}
                            </p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {alert.alert_type.replace('_', ' ')}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold">
                            {alert.current_stock}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            in stock
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </BentoCard>
            </div>
          )}

          {isWidgetVisible('inventory-forecast') && (
            <div key="inventory-forecast">
              <BentoCard
                title="Stock Forecast"
                icon={TrendingUp}
                className="h-full"
              >
                <div className="space-y-3 custom-scrollbar overflow-y-auto max-h-[300px] pr-2">
                  {(data?.inventoryForecasts || []).length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No forecast data available</p>
                      <p className="text-xs">
                        Add products with stock tracking enabled
                      </p>
                    </div>
                  ) : (
                    data?.inventoryForecasts?.slice(0, 8).map((forecast) => (
                      <div
                        key={forecast.product_id}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {forecast.product_name}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{forecast.current_stock} units</span>
                            <span>•</span>
                            <span>{forecast.avg_daily_sales}/day</span>
                          </div>
                        </div>
                        <div className="text-right ml-2">
                          <p
                            className={cn(
                              'text-sm font-bold',
                              forecast.days_of_stock <= 7
                                ? 'text-red-500'
                                : forecast.days_of_stock <= 14
                                  ? 'text-amber-500'
                                  : 'text-green-500'
                            )}
                          >
                            {Math.round(forecast.days_of_stock)} days
                          </p>
                          <div
                            className={cn(
                              'text-xs flex items-center gap-1 justify-end',
                              forecast.sales_trend === 'increasing'
                                ? 'text-green-500'
                                : forecast.sales_trend === 'decreasing'
                                  ? 'text-red-500'
                                  : 'text-muted-foreground'
                            )}
                          >
                            {forecast.sales_trend === 'increasing' && '↑'}
                            {forecast.sales_trend === 'decreasing' && '↓'}
                            {forecast.sales_trend === 'stable' && '→'}
                            {forecast.sales_trend}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </BentoCard>
            </div>
          )}

          {isWidgetVisible('low-stock-products') && (
            <div key="low-stock-products">
              <BentoCard
                title="Low Stock Products"
                icon={Package}
                className="h-full"
              >
                <div className="space-y-2 custom-scrollbar overflow-y-auto max-h-[200px] pr-2">
                  {(
                    data?.inventoryForecasts?.filter(
                      (f) => f.days_of_stock <= 14
                    ) || []
                  ).length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      <p className="text-sm">All products well stocked</p>
                    </div>
                  ) : (
                    data?.inventoryForecasts
                      ?.filter((f) => f.days_of_stock <= 14)
                      .slice(0, 5)
                      .map((product) => (
                        <div
                          key={product.product_id}
                          className="flex items-center justify-between p-2 rounded-lg bg-amber-500/10"
                        >
                          <span className="text-sm truncate flex-1">
                            {product.product_name}
                          </span>
                          <span className="text-sm font-bold text-amber-600 ml-2">
                            {product.current_stock} left
                          </span>
                        </div>
                      ))
                  )}
                </div>
              </BentoCard>
            </div>
          )}

          {/* Customer Segment Widgets */}
          {isWidgetVisible('segment-overview') && (
            <div key="segment-overview">
              <BentoCard
                title="Segment Overview"
                icon={Target}
                className="h-full"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Total Customers
                    </span>
                    <span className="text-2xl font-bold">
                      {data?.segmentSummary?.total_customers || 0}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-green-500/10 text-center">
                      <Crown className="w-5 h-5 mx-auto mb-1 text-green-600" />
                      <div className="text-lg font-bold text-green-600">
                        {data?.segmentSummary?.champions_count || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Champions
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-red-500/10 text-center">
                      <AlertTriangle className="w-5 h-5 mx-auto mb-1 text-red-600" />
                      <div className="text-lg font-bold text-red-600">
                        {data?.segmentSummary?.at_risk_count || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        At Risk
                      </div>
                    </div>
                  </div>
                </div>
              </BentoCard>
            </div>
          )}

          {isWidgetVisible('segment-distribution') && (
            <div key="segment-distribution">
              <BentoCard
                title="Segment Distribution"
                icon={Users}
                className="h-full"
              >
                <div className="space-y-3">
                  {(data?.segmentSummary?.segments || []).map((segment) => {
                    const total = data?.segmentSummary?.total_customers || 1;
                    const percentage = Math.round(
                      (segment.count / total) * 100
                    );
                    const colorMap: Record<string, string> = {
                      Champions: 'bg-green-500',
                      Loyal: 'bg-blue-500',
                      Potential: 'bg-purple-500',
                      New: 'bg-cyan-500',
                      'At Risk': 'bg-amber-500',
                      Hibernating: 'bg-orange-500',
                      Lost: 'bg-red-500',
                    };
                    return (
                      <div key={segment.segment} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>{segment.segment}</span>
                          <span className="font-medium">
                            {segment.count} ({percentage}%)
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn(
                              'h-full transition-all',
                              colorMap[segment.segment] || 'bg-primary'
                            )}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {(data?.segmentSummary?.segments || []).length === 0 && (
                    <div className="text-center py-4 text-muted-foreground">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No segment data yet</p>
                    </div>
                  )}
                </div>
              </BentoCard>
            </div>
          )}

          {isWidgetVisible('at-risk-customers') && (
            <div key="at-risk-customers">
              <BentoCard
                title="At-Risk Customers"
                icon={AlertTriangle}
                className="h-full"
              >
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground mb-3">
                    Customers who haven&apos;t purchased recently and may churn
                  </p>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10">
                    <div>
                      <div className="text-2xl font-bold text-red-600">
                        {data?.segmentSummary?.at_risk_count || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        customers at risk
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {atRiskSegment?.avg_clv
                          ? formatCurrency(atRiskSegment.avg_clv)
                          : 'N/A'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        avg. CLV
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Consider re-engagement campaigns to win them back
                  </p>
                </div>
              </BentoCard>
            </div>
          )}

          {isWidgetVisible('champions-list') && (
            <div key="champions-list">
              <BentoCard
                title="Champion Customers"
                icon={Crown}
                className="h-full"
              >
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground mb-3">
                    Your most valuable customers - frequent buyers with high
                    spend
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg bg-green-500/10 text-center">
                      <div className="text-lg font-bold text-green-600">
                        {data?.segmentSummary?.champions_count || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Champions
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30 text-center">
                      <div className="text-lg font-bold">
                        {championsSegment?.avg_order_value
                          ? formatCurrency(championsSegment.avg_order_value)
                          : 'N/A'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Avg Order
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30 text-center">
                      <div className="text-lg font-bold">
                        {championsSegment?.avg_clv
                          ? formatCurrency(championsSegment.avg_clv)
                          : 'N/A'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Avg CLV
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Reward these customers with exclusive offers and early
                    access
                  </p>
                </div>
              </BentoCard>
            </div>
          )}
        </ResponsiveGridLayout>
      </div>
    </div>
  );
}
