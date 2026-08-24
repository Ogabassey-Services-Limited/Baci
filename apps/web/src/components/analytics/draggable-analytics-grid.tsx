'use client';

import type { MerchantAnalyticsResponse } from '@baci/shared';
import {
  Activity,
  AlertTriangle,
  Check,
  Crown,
  DollarSign,
  Package,
  Percent,
  RefreshCcw,
  Settings2,
  ShoppingBag,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  type Layout,
  Responsive,
  type ResponsiveLayouts,
  WidthProvider,
} from 'react-grid-layout/legacy';
import { renderAdsAnalyticsWidgets } from '@/components/analytics/ads-analytics-widgets';
import { AIInsightsPanel } from '@/components/analytics/ai-insights-panel';
import type { AnalyticsCategory } from '@/components/analytics/analytics-category-nav';
import {
  type AnalyticsDetailWidgetId,
  AnalyticsDetailWidgets,
} from '@/components/analytics/analytics-detail-widgets';
import {
  hydrateDashboardLayoutConfig,
  mergeDashboardLayoutConfig,
} from '@/components/analytics/analytics-grid-layout-hydration';
import {
  ANALYTICS_WIDGET_IDS_BY_CATEGORY,
  type Layouts,
  resolveCategoryLayouts,
} from '@/components/analytics/analytics-grid-layouts';
import {
  RevenueChart,
  SalesByChannelChart,
} from '@/components/analytics/chart-components';
import { formatMetricChange } from '@/components/analytics/format-metric-change';
import type { GoogleAdsReportingData } from '@/components/analytics/google-ads-reporting-card';
import type { SocialAdsReportingData } from '@/components/analytics/social-ads-reporting-card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BentoCard } from '@/components/ui/bento-card';
import { Button } from '@/components/ui/button';
import type { MerchantData } from '@/hooks/merchant/types';
import { createDashboardLayoutSaveQueue } from '@/lib/analytics/dashboard-layout-save-queue';
import type { AdsSyncWindow } from '@/lib/analytics/default-ads-sync-window';
import {
  fetchDashboardLayoutPreference,
  saveDashboardLayoutPreference,
} from '@/lib/analytics/save-dashboard-layout-preference';
import { getCountryByCode } from '@/lib/countries';
import { cn } from '@/lib/utils';

const ANALYTICS_DETAIL_WIDGET_IDS: readonly AnalyticsDetailWidgetId[] = [
  'orders-chart',
  'brand-breakdown',
  'customer-breakdown',
  'supplier-breakdown',
  'blog-performance',
];

const ResponsiveGridLayout = WidthProvider(Responsive);

const _currencyFormatterCache = new Map<string, Intl.NumberFormat>();
function getCurrencyFormatter(
  locale: string,
  currency: string,
  useCompact: boolean
): Intl.NumberFormat {
  const key = `${locale}:${currency}:${useCompact}`;
  let formatter = _currencyFormatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay: 'symbol',
      notation: useCompact ? 'compact' : 'standard',
      maximumFractionDigits: useCompact ? 1 : 2,
    });
    _currencyFormatterCache.set(key, formatter);
  }
  return formatter;
}

const PERCENT_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

// Dynamically load grid layout CSS to avoid render-blocking. Hoisted to
// module scope so the dynamic `import()` expressions don't bail out the
// React Compiler on the grid component.
function loadGridLayoutStyles(): void {
  import('react-grid-layout/css/styles.css');
  import('react-resizable/css/styles.css');
}

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
}

export function formatTopProductUnits(units: number | undefined): string {
  return `${units ?? 0} units sold`;
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
  total_revenue?: number;
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
  totalSpend?: number;
  totalRoas?: number;
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
  ordersWithTracking: number;
}

export interface AdAnalyticsData {
  googleAds?: GoogleAdsReportingData;
  socialAds?: SocialAdsReportingData;
  summary: AdAnalyticsSummary;
  details: AdAnalyticsDetails;
  platforms: AdPlatformData[];
  offlineConversionsEnabled: boolean;
  configuredPlatforms: number;
}

export interface AnalyticsData {
  blog?: MerchantAnalyticsResponse['blog'];
  brandBreakdown?: MerchantAnalyticsResponse['brandBreakdown'];
  summary?: AnalyticsSummary;
  chartData?: MerchantAnalyticsResponse['chartData'];
  customerBreakdown?: MerchantAnalyticsResponse['customerBreakdown'];
  revenueOverTime?: unknown[];
  salesByChannel?: Array<{ name: string; value: number }>;
  salesByPaymentMethod?: Array<{ name: string; value: number }>;
  recentSales?: SaleRecord[];
  topProducts?: ProductRecord[];
  supplierAnalytics?: MerchantAnalyticsResponse['supplierAnalytics'];
  topBrand?: MerchantAnalyticsResponse['topBrand'];
  topCustomer?: MerchantAnalyticsResponse['topCustomer'];
  topPaymentMethod?: MerchantAnalyticsResponse['topPaymentMethod'];
  topSupplier?: MerchantAnalyticsResponse['topSupplier'];
  paymentMethods?: Array<{ name: string; value: number }>;
  // Inventory data
  inventoryAlerts?: InventoryAlert[];
  inventoryForecasts?: InventoryForecast[];
  lowStockCount?: number;
  outOfStockCount?: number;
  resolvedInventoryAlertCount?: number;
  // Segment data
  segmentSummary?: SegmentSummary;
  // Ad analytics data
  adAnalytics?: AdAnalyticsData;
}

interface DraggableAnalyticsGridProps {
  data: AnalyticsData;
  loading: boolean;
  activeCategory: AnalyticsCategory;
  merchant: MerchantData | null;
  categoryError?: string | null;
  onAdsReportingSynced?: () => void;
  syncWindow?: AdsSyncWindow;
}

export function DraggableAnalyticsGrid({
  data,
  loading,
  activeCategory,
  merchant,
  categoryError,
  onAdsReportingSynced,
  syncWindow,
}: DraggableAnalyticsGridProps) {
  const [isEditMode, setIsEditMode] = useState(false);

  // Dynamically load grid layout CSS to avoid render-blocking
  useEffect(() => {
    loadGridLayoutStyles();
  }, []);

  const [layouts, setLayouts] = useState<Layouts>(() =>
    resolveCategoryLayouts(activeCategory)
  );
  const [_persistedLayoutConfig, setPersistedLayoutConfig] =
    useState<unknown>(null);
  const persistedLayoutConfigRef = useRef<unknown>(null);
  const layoutSaveQueueRef = useRef(
    createDashboardLayoutSaveQueue(saveDashboardLayoutPreference)
  );
  const [prevCategory, setPrevCategory] = useState(activeCategory);
  const [prevMerchantId, setPrevMerchantId] = useState(merchant?.id);

  // Sync layouts to the active category during render (instead of an effect)
  // so users never see a stale layout between the prop change and the commit.
  if (activeCategory !== prevCategory || merchant?.id !== prevMerchantId) {
    setPrevCategory(activeCategory);
    setPrevMerchantId(merchant?.id);
    setLayouts(resolveCategoryLayouts(activeCategory));
  }

  // Hydrate the selected merchant/category layout after the default layout is
  // in place. Abort and generation checks prevent stale responses from a
  // previous merchant or category overwriting the active layout.
  useEffect(() => {
    if (!merchant?.id) return;

    const controller = new AbortController();
    layoutSaveQueueRef.current.reset();
    persistedLayoutConfigRef.current = null;
    setPersistedLayoutConfig(null);

    void fetchDashboardLayoutPreference(merchant.id, controller.signal)
      .then((layoutConfig) => {
        if (controller.signal.aborted) return;

        setPersistedLayoutConfig(layoutConfig);
        persistedLayoutConfigRef.current = layoutConfig;
        const hydratedLayouts = hydrateDashboardLayoutConfig(
          layoutConfig,
          activeCategory
        );
        if (hydratedLayouts) {
          setLayouts(hydratedLayouts);
        }
      })
      .catch((error: unknown) => {
        if (
          controller.signal.aborted ||
          (error instanceof Error && error.name === 'AbortError')
        ) {
          return;
        }
        console.error('Failed to hydrate dashboard layout:', error);
      });

    return () => {
      controller.abort();
      layoutSaveQueueRef.current.reset();
    };
  }, [activeCategory, merchant?.id]);

  // Save layout change
  const onLayoutChange = (
    _currentLayout: Layout,
    allLayouts: ResponsiveLayouts
  ) => {
    const completeLayouts: Layouts = {
      ...resolveCategoryLayouts(activeCategory),
      ...allLayouts,
    };
    const nextLayoutConfig = mergeDashboardLayoutConfig(
      persistedLayoutConfigRef.current,
      activeCategory,
      completeLayouts
    );
    setLayouts(completeLayouts);
    persistedLayoutConfigRef.current = nextLayoutConfig;
    setPersistedLayoutConfig(nextLayoutConfig);
    if (!isEditMode) return; // Only save if in edit mode (optional, but good for performance)

    void layoutSaveQueueRef.current
      .enqueue(nextLayoutConfig, merchant?.id)
      .catch((error) => {
        if (error instanceof Error && error.name === 'AbortError') return;
        console.error('Failed to save layout:', error);
      });
  };

  const atRiskSegment = data?.segmentSummary?.segments?.find(
    (s) => s.segment === 'At Risk'
  );

  const championsSegment = data?.segmentSummary?.segments?.find(
    (s) => s.segment === 'Champions'
  );

  const categoryErrorBanner = categoryError ? (
    <Alert className="mb-4" variant="destructive">
      <AlertTriangle className="size-4" />
      <AlertDescription>{categoryError}</AlertDescription>
    </Alert>
  ) : null;

  if (loading) {
    return (
      <div className="space-y-4">
        {/* AI Insights skeleton - already handled by AIInsightsPanel */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0 w-full">
            <AIInsightsPanel
              activeCategory={activeCategory}
              merchantId={merchant?.id}
            />
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
              <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
              <div className="p-4 space-y-2">
                <div className="h-3 w-20 bg-muted/30 rounded" />
                <div className="h-6 w-24 bg-muted/20 rounded" />
              </div>
            </div>
          ))}
          <div className="col-span-1 md:col-span-3 h-80 bg-muted/10 rounded-2xl border border-border/50 overflow-hidden relative">
            <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
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
            <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
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
    if (activeCategory === 'overview') {
      return ANALYTICS_WIDGET_IDS_BY_CATEGORY.overview.includes(key);
    }

    return ANALYTICS_WIDGET_IDS_BY_CATEGORY[activeCategory]?.includes(key);
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
    return getCurrencyFormatter(locale, currency, useCompact).format(value);
  };

  const formatPercent = (value: number) => {
    return PERCENT_FORMATTER.format(value / 100);
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
            <span>{formatMetricChange(change)}</span>
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
  const paymentMethods = data?.salesByPaymentMethod ?? [];

  if (!isEditMode) {
    // VIEW MODE: Use native CSS Grid for perfect responsiveness
    return (
      <div className="w-full max-w-full overflow-hidden space-y-4">
        {categoryErrorBanner}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0 w-full">
            <AIInsightsPanel
              activeCategory={activeCategory}
              merchantId={merchant?.id}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditMode(true)}
            className="gap-2 shrink-0"
            aria-label="Customize Dashboard Layout"
          >
            <Settings2 className="size-4" />
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
              'Gross Profit 📈',
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
              Math.abs(summary.taxDue?.change || 0),
              DollarSign,
              // Tax is a cash-flow cost from the merchant's POV, so a period
              // with *lower* tax owed is displayed as the "up" (positive)
              // direction even though the change value itself went down.
              (summary.taxDue?.change || 0) <= 0 ? 'up' : 'down'
            )}
          {isWidgetVisible('summary-active') &&
            renderMetricCard(
              'summary-active',
              'Orders Last Hour 🟢',
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

        {isWidgetVisible('analytics-highlights') && (
          <BentoCard title="Business Highlights ✨" className="w-full">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-xl bg-primary/5 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Top brand
                </p>
                <p className="mt-2 truncate text-lg font-bold">
                  {data.topBrand?.name || 'No brand data'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {data.topBrand
                    ? formatCurrency(
                        data.topBrand.revenue ?? data.topBrand.value
                      )
                    : '—'}
                </p>
              </div>
              <div className="rounded-xl bg-emerald-500/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Top supplier
                </p>
                <p className="mt-2 truncate text-lg font-bold">
                  {data.topSupplier?.supplierName || 'No supplier data'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {data.topSupplier
                    ? `${formatCurrency(data.topSupplier.grossProfit)} gross profit`
                    : '—'}
                </p>
              </div>
              <div className="rounded-xl bg-blue-500/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Blog views
                </p>
                <p className="mt-2 text-lg font-bold">
                  {(data.blog?.totalViews || 0).toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">
                  {data.blog?.publishedPosts || 0} published posts
                </p>
              </div>
              <div className="rounded-xl bg-amber-500/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Top payment method
                </p>
                <p className="mt-2 truncate text-lg font-bold">
                  {data.topPaymentMethod?.name || 'No payment data'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {data.topPaymentMethod
                    ? `${data.topPaymentMethod.value.toFixed(1)}% of payment revenue`
                    : '—'}
                </p>
              </div>
              <div className="rounded-xl bg-violet-500/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Top customer
                </p>
                <p className="mt-2 truncate text-lg font-bold">
                  {data.topCustomer?.name || 'No customer data'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {data.topCustomer
                    ? `${formatCurrency(data.topCustomer.revenue ?? 0)} revenue`
                    : '—'}
                </p>
              </div>
            </div>
          </BentoCard>
        )}

        {/* Charts & Detailed Views Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Revenue Chart - Spans 2 columns on lg */}
          {isWidgetVisible('revenue-chart') && (
            <div className="lg:col-span-2 min-h-[400px]">
              <BentoCard title="Revenue Over Time" className="h-full">
                <RevenueChart
                  data={chartData || []}
                  valueFormatter={formatCurrency}
                />
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
                            <span className="font-medium">
                              {formatCurrency(pm.value)} · {percentage}%
                            </span>
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

        {/* Additional base analytics breakdowns */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {ANALYTICS_DETAIL_WIDGET_IDS.map((widgetId) =>
            isWidgetVisible(widgetId) ? (
              <AnalyticsDetailWidgets
                data={data}
                formatCurrency={formatCurrency}
                key={widgetId}
                widgetId={widgetId}
              />
            ) : null
          )}
        </div>

        {/* Bottom Lists Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {isWidgetVisible('sales-channel') && (
            <div className="min-h-[350px]">
              <BentoCard title="Sales by Channel 📊" className="h-full">
                <SalesByChannelChart
                  data={salesByChannel || []}
                  valueFormatter={formatCurrency}
                />
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
                        <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
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
                      <div className="size-8 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-secondary-foreground">
                          #{i + 1}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">
                          {product.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatTopProductUnits(product.units)}
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

        {activeCategory === 'ads' &&
          renderAdsAnalyticsWidgets({
            adAnalytics: data?.adAnalytics,
            formatCurrency,
            isWidgetVisible,
            onAdsReportingSynced,
            syncWindow,
          })}
      </div>
    );
  }

  // EDIT MODE: Use ReactGridLayout for drag-and-drop customization
  return (
    <div className="w-full">
      {categoryErrorBanner}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
        <div className="flex-1 min-w-0 w-full">
          <AIInsightsPanel
            activeCategory={activeCategory}
            merchantId={merchant?.id}
          />
        </div>
        <Button
          variant="default"
          size="sm"
          onClick={() => setIsEditMode(false)}
          className="gap-2 shrink-0"
          aria-label="Save Dashboard Layout"
        >
          <Check className="size-4" />
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
          {isWidgetVisible('summary-units') &&
            renderMetricCard(
              'summary-units',
              'Units Sold 🛒',
              (summary.totalUnitsSold || 0).toString(),
              0,
              Package,
              'up'
            )}
          {isWidgetVisible('summary-profit') &&
            renderMetricCard(
              'summary-profit',
              'Gross Profit 📈',
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
              Math.abs(summary.taxDue?.change || 0),
              DollarSign,
              // Tax is a cash-flow cost from the merchant's POV, so a period
              // with *lower* tax owed is displayed as the "up" (positive)
              // direction even though the change value itself went down.
              (summary.taxDue?.change || 0) <= 0 ? 'up' : 'down'
            )}

          {isWidgetVisible('analytics-highlights') && (
            <div key="analytics-highlights">
              <BentoCard title="Business Highlights ✨" className="h-full">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="rounded-xl bg-primary/5 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Top brand
                    </p>
                    <p className="mt-2 truncate text-lg font-bold">
                      {data.topBrand?.name || 'No brand data'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {data.topBrand
                        ? formatCurrency(
                            data.topBrand.revenue ?? data.topBrand.value
                          )
                        : '—'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-emerald-500/10 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Top supplier
                    </p>
                    <p className="mt-2 truncate text-lg font-bold">
                      {data.topSupplier?.supplierName || 'No supplier data'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {data.topSupplier
                        ? `${formatCurrency(data.topSupplier.grossProfit)} gross profit`
                        : '—'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-blue-500/10 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Blog views
                    </p>
                    <p className="mt-2 text-lg font-bold">
                      {(data.blog?.totalViews || 0).toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {data.blog?.publishedPosts || 0} published posts
                    </p>
                  </div>
                  <div className="rounded-xl bg-amber-500/10 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Top payment method
                    </p>
                    <p className="mt-2 truncate text-lg font-bold">
                      {data.topPaymentMethod?.name || 'No payment data'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {data.topPaymentMethod
                        ? `${data.topPaymentMethod.value.toFixed(1)}% of payment revenue`
                        : '—'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-violet-500/10 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Top customer
                    </p>
                    <p className="mt-2 truncate text-lg font-bold">
                      {data.topCustomer?.name || 'No customer data'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {data.topCustomer
                        ? `${formatCurrency(data.topCustomer.revenue ?? 0)} revenue`
                        : '—'}
                    </p>
                  </div>
                </div>
              </BentoCard>
            </div>
          )}

          {isWidgetVisible('financial-summary') && (
            <div key="financial-summary">
              <BentoCard title="Financial Position 🏦" className="h-full">
                <div className="grid grid-cols-1 gap-6 rounded-2xl bg-slate-900 p-4 text-white md:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Subtotal
                    </p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(summary.subtotal || 0)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Shipping
                    </p>
                    <p className="text-2xl font-bold text-blue-400">
                      {formatCurrency(summary.shipping || 0)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Tax (VAT)
                    </p>
                    <p className="text-2xl font-bold text-purple-400">
                      {formatCurrency(summary.tax || 0)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Discounts
                    </p>
                    <p className="text-2xl font-bold text-red-400">
                      -{formatCurrency(summary.discounts || 0)}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-border/50 p-4">
                  <span className="text-lg font-bold">Net Sales</span>
                  <span className="text-2xl font-black text-primary">
                    {formatCurrency(summary.revenue.value)}
                  </span>
                </div>
              </BentoCard>
            </div>
          )}

          {ANALYTICS_DETAIL_WIDGET_IDS.map((widgetId) =>
            isWidgetVisible(widgetId) ? (
              <AnalyticsDetailWidgets
                data={data}
                formatCurrency={formatCurrency}
                key={widgetId}
                widgetId={widgetId}
              />
            ) : null
          )}

          {isWidgetVisible('payment-methods') && (
            <div key="payment-methods">
              <BentoCard title="Payment Methods 💳" className="h-full">
                <div className="space-y-4">
                  {paymentMethods.length ? (
                    paymentMethods.map((pm, idx) => {
                      const totalValue = paymentMethods.reduce(
                        (acc, curr) => acc + curr.value,
                        0
                      );
                      const percentage = totalValue
                        ? Math.round((pm.value / totalValue) * 100)
                        : 0;
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
                            <span className="font-medium">
                              {formatCurrency(pm.value)} · {percentage}%
                            </span>
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
                    <div className="text-sm italic text-muted-foreground">
                      No payment data available
                    </div>
                  )}
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
              'Orders Last Hour 🟢',
              summary.activeNow.value.toString(),
              summary.activeNow.change,
              Activity,
              'up'
            )}

          {isWidgetVisible('revenue-chart') && (
            <div key="revenue-chart">
              <BentoCard title="Revenue Over Time" className="h-full">
                <RevenueChart
                  data={data?.chartData || []}
                  valueFormatter={formatCurrency}
                />
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
                        <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
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
                <SalesByChannelChart
                  data={data?.salesByChannel || []}
                  valueFormatter={formatCurrency}
                />
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
                        <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                          #{index + 1}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{product.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatTopProductUnits(product.units)}
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
                      {data?.resolvedInventoryAlertCount || 0}
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
                      <Package className="size-8 mx-auto mb-2 opacity-50" />
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
                      <TrendingUp className="size-8 mx-auto mb-2 opacity-50" />
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
                      <Crown className="size-5 mx-auto mb-1 text-green-600" />
                      <div className="text-lg font-bold text-green-600">
                        {data?.segmentSummary?.champions_count || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Champions
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-red-500/10 text-center">
                      <AlertTriangle className="size-5 mx-auto mb-1 text-red-600" />
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
                      <Users className="size-8 mx-auto mb-2 opacity-50" />
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
                        {championsSegment?.total_revenue
                          ? formatCurrency(championsSegment.total_revenue)
                          : 'N/A'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Segment Revenue
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

          {activeCategory === 'ads' &&
            renderAdsAnalyticsWidgets({
              adAnalytics: data?.adAnalytics,
              editMode: true,
              formatCurrency,
              isWidgetVisible,
              onAdsReportingSynced,
              syncWindow,
            })}
        </ResponsiveGridLayout>
      </div>
    </div>
  );
}
