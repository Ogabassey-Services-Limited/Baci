'use client';

import {
  Activity,
  ArrowRight,
  ArrowUp,
  CreditCard,
  DollarSign,
  Globe,
  Loader2,
  Package,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AgenticActionCenterCard } from '@/components/dashboard/agentic-action-center-card';
import { AgenticTrustCenterCard } from '@/components/dashboard/agentic-trust-center-card';
import { SetupChecklist } from '@/components/dashboard/setup-checklist';
import { StoreBuildStatusCard } from '@/components/dashboard/store-build-status-card';
import { BentoCard } from '@/components/ui/bento-card';
import { Button } from '@/components/ui/button';
import type { ChartConfig } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { useMerchant } from '@/hooks/use-merchant-client';
import { useToast } from '@/hooks/use-toast';
import { formatPrice } from '@/lib/currency-utils';
import { requestMerchantPublish } from '@/lib/merchant-publish-client';
import type { AgentCommerceTrustReadinessSummary } from '@/lib/storefront-trust/build-agent-commerce-trust-readiness';
import { cn } from '@/lib/utils';
import {
  type DashboardMetrics,
  getDashboardMetrics,
  getMonthlyChartData,
  getRecentSales,
  type MonthlyChartData,
  type RecentSale,
} from './actions';

// Dynamically import chart wrapper components (correct pattern)
const RevenueSparkline = dynamic(
  () =>
    import('@/components/dashboard/dashboard-charts').then(
      (mod) => mod.RevenueSparkline
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-full w-full min-h-[100px]" />,
  }
);

const RevenueBarChart = dynamic(
  () =>
    import('@/components/dashboard/dashboard-charts').then(
      (mod) => mod.RevenueBarChart
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-full w-full min-h-[400px]" />,
  }
);

const chartConfig = {
  revenue: {
    label: 'Revenue',
    color: 'hsl(var(--primary))',
  },
  profit: {
    label: 'Profit',
    color: 'hsl(142 76% 36%)',
  },
  orders: {
    label: 'Orders',
    color: 'hsl(var(--accent))',
  },
} satisfies ChartConfig;

interface DashboardClientPageProps {
  initialMetrics?: DashboardMetrics;
  initialRecentSales?: RecentSale[];
  initialChartData?: MonthlyChartData[];
  initialTrustCenterState?: 'ready' | 'error' | 'unauthorized';
  initialTrustReadiness?: AgentCommerceTrustReadinessSummary | null;
}

export default function DashboardClientPage({
  initialMetrics,
  initialRecentSales,
  initialChartData,
  initialTrustCenterState = 'error',
  initialTrustReadiness = null,
}: DashboardClientPageProps) {
  const { merchant, reloadMerchant } = useMerchant();
  const router = useRouter();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  // TODO: These will be used for metric selector dropdown
  // const [heroMetric, setHeroMetric] = useState<'revenue' | 'orders' | 'visitors'>('revenue');
  // const [timePeriod, setTimePeriod] = useState('This Week');
  const [dashboardData, setDashboardData] = useState<DashboardMetrics>(
    initialMetrics || {
      revenue: { value: 0, change: 0 },
      customers: { value: 0, change: 0 },
      orders: { value: 0, change: 0 },
      activeNow: { value: 0, change: 0 },
      fulfillmentRate: 0,
      aov: 0,
    }
  );
  const [recentSales, setRecentSales] = useState<RecentSale[]>(
    initialRecentSales || []
  );
  const [monthlyChartData, setMonthlyChartData] = useState<MonthlyChartData[]>(
    initialChartData || []
  );

  useEffect(() => {
    setMounted(true);

    // If we have initial data, don't fetch again on mount
    if (initialMetrics && initialRecentSales && initialChartData) {
      return;
    }

    // Fetch real data from the database
    if (merchant?.id) {
      Promise.all([
        getDashboardMetrics(merchant.id),
        getRecentSales(merchant.id, 5),
        getMonthlyChartData(merchant.id),
      ])
        .then(([metrics, sales, chartData]) => {
          setDashboardData(metrics);
          setRecentSales(sales);
          setMonthlyChartData(chartData);
        })
        .catch((error) => {
          console.error('Failed to load dashboard data:', error);
        });
    }
  }, [merchant?.id, initialMetrics, initialRecentSales, initialChartData]);

  const handlePublishToggle = async () => {
    setIsPublishing(true);
    try {
      const response = await requestMerchantPublish(merchant?.is_published);
      const data = await response.json();

      if (!response.ok) {
        toast({
          title: data.error || 'Failed to update store status',
          description: data.missingItems?.join(', ') || data.message,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: merchant?.is_published
          ? 'Store Unpublished'
          : 'Store Published!',
        description: merchant?.is_published
          ? 'Your store is now offline.'
          : 'Your store is now live and accessible to customers.',
      });
      reloadMerchant();
      router.refresh();
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'Failed to update store status. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsPublishing(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6 p-3 md:p-6 pb-24 md:pb-8 overflow-x-hidden">
      {/* Store Publish Status Banner - Desktop only */}
      <div
        className={cn(
          'hidden md:flex rounded-lg border p-4 flex-col sm:flex-row items-start sm:items-center justify-between gap-4',
          merchant?.is_published
            ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800'
            : 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800'
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'p-2 rounded-full',
              merchant?.is_published
                ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400'
                : 'bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-400'
            )}
          >
            <Globe className="h-5 w-5" />
          </div>
          <div>
            <p className="font-medium">
              {merchant?.is_published ? 'Store is Live' : 'Store is Offline'}
            </p>
            <p className="text-sm text-muted-foreground">
              {merchant?.is_published
                ? 'Customers can access your store and place orders.'
                : 'Your store is not visible to customers. Publish when ready.'}
            </p>
          </div>
        </div>
        <Button
          onClick={handlePublishToggle}
          disabled={isPublishing}
          variant={merchant?.is_published ? 'outline' : 'default'}
          className={cn(
            !merchant?.is_published && 'bg-green-600 hover:bg-green-700'
          )}
        >
          {isPublishing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Globe className="mr-2 h-4 w-4" />
          )}
          {isPublishing
            ? 'Updating...'
            : merchant?.is_published
              ? 'Unpublish Store'
              : 'Publish Store'}
        </Button>
      </div>

      {/* Header Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* Mobile Greeting Header - Bumpa Style */}
        <div className="md:hidden space-y-4">
          {/* Top Row: Avatar + Greeting + Badge + Notification */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-semibold text-muted-foreground border">
                {merchant?.business_name?.charAt(0) || 'B'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold">
                    Hi,{' '}
                    <span className="capitalize bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-400 bg-clip-text text-transparent">
                      {merchant?.business_name?.split(' ')[0] || 'Merchant'}
                    </span>
                  </h2>
                  {merchant?.is_published && (
                    <span className="text-[10px] font-medium bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                      LIVE
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Share your referral code today. 🎉
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="icon" variant="ghost" className="relative h-9 w-9">
                <div className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full" />
                <Users className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Action Chips */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs rounded-full border-muted-foreground/30"
              asChild
            >
              <a
                href={merchant?.slug ? `/${merchant.slug}` : '#'}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Globe className="h-3 w-3 mr-1.5" />
                Visit store
              </a>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs rounded-full border-muted-foreground/30"
              onClick={() => {
                navigator.clipboard.writeText(
                  merchant?.slug
                    ? `${window.location.origin}/${merchant.slug}`
                    : ''
                );
              }}
            >
              <ArrowUp className="h-3 w-3 mr-1.5 rotate-45" />
              Share link
            </Button>
          </div>
        </div>

        {/* Desktop Header */}
        <div className="hidden md:block space-y-1">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary via-purple-500 to-blue-600 bg-clip-text text-transparent">
            Dashboard
          </h1>
          <p className="text-muted-foreground">
            Overview of your store's performance
          </p>
        </div>

        <div className="hidden md:flex items-center gap-2">
          <Button className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25">
            <Sparkles className="mr-2 h-4 w-4" />
            Ask AI Assistant
          </Button>
        </div>
      </div>

      {/* Setup Checklist - Shows prominently until store is fully set up */}
      <div
        className="animate-in fade-in slide-in-from-bottom-4 duration-500"
        style={{ animationFillMode: 'both' }}
      >
        <StoreBuildStatusCard />
        <SetupChecklist dismissible />
      </div>

      {merchant?.is_published && (
        <div
          className="animate-in fade-in slide-in-from-bottom-4 duration-500"
          style={{ animationFillMode: 'both', animationDelay: '0.05s' }}
        >
          <AgenticActionCenterCard />
        </div>
      )}

      {merchant?.is_published && (
        <div
          className="animate-in fade-in slide-in-from-bottom-4 duration-500"
          style={{ animationFillMode: 'both', animationDelay: '0.075s' }}
        >
          <AgenticTrustCenterCard
            readiness={initialTrustReadiness}
            state={initialTrustCenterState}
          />
        </div>
      )}

      {/* AI Insight Hero - Desktop only */}
      {merchant?.is_published && (
        <div
          className="hidden md:block animate-in fade-in slide-in-from-bottom-4 duration-500"
          style={{ animationFillMode: 'both', animationDelay: '0.1s' }}
        >
          <BentoCard
            className="bg-gradient-to-br from-primary/10 via-background to-accent/5 border-primary/20"
            noPadding
          >
            <div className="p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center gap-6">
              <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                <Sparkles className="h-8 w-8" />
              </div>
              <div className="space-y-2 flex-1">
                <h2 className="text-xl font-semibold">
                  Good morning,{' '}
                  <span className="capitalize">
                    {merchant?.slug || merchant?.business_name || 'Merchant'}
                  </span>
                  !
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  {dashboardData.revenue.change > 0 ? (
                    <>
                      Your store is performing well! Revenue is up{' '}
                      <span className="text-green-500 font-medium">
                        +{dashboardData.revenue.change}%
                      </span>{' '}
                      compared to last month. Keep up the great work!
                    </>
                  ) : dashboardData.revenue.change < 0 ? (
                    <>
                      Revenue is down{' '}
                      <span className="text-red-500 font-medium">
                        {dashboardData.revenue.change}%
                      </span>{' '}
                      compared to last month. Consider running a promotion to
                      boost sales.
                    </>
                  ) : (
                    <>
                      Welcome to your dashboard! Start adding products and
                      promoting your store to see your revenue grow.
                    </>
                  )}
                </p>
              </div>
              <Button variant="outline" className="shrink-0 w-full md:w-auto">
                View Insights
              </Button>
            </div>
          </BentoCard>
        </div>
      )}

      {/* Mobile AI Insight Hero (Compact) */}
      {merchant?.is_published && (
        <div className="md:hidden mb-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-gradient-to-r from-blue-50 to-white dark:from-blue-950/20 dark:to-background border border-blue-100 dark:border-blue-900 rounded-xl p-3 flex items-center gap-3 shadow-sm">
            <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-medium truncate">
                Good morning,{' '}
                <span className="capitalize">
                  {merchant?.business_name?.split(' ')[0] || 'Merchant'}
                </span>
              </h2>
              <p className="text-xs text-muted-foreground truncate">
                {dashboardData.revenue.change >= 0 ? (
                  <>
                    Revenue is up{' '}
                    <span className="text-green-600 font-medium">
                      +{dashboardData.revenue.change}%
                    </span>{' '}
                    vs last month
                  </>
                ) : (
                  <>
                    Revenue is down{' '}
                    <span className="text-red-500 font-medium">
                      {dashboardData.revenue.change}%
                    </span>{' '}
                    vs last month
                  </>
                )}
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0 -mr-1"
            >
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        </div>
      )}

      <div className="md:hidden space-y-4">
        {/* Compact Stat Row - 4 cards with Blue/White/Yellow Theme & Inline Icons */}
        <div className="grid grid-cols-4 gap-2 my-4">
          {/* Orders - Blue (Primary) */}
          <div className="bg-blue-50/80 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900 p-2 text-center flex flex-col justify-center h-20">
            <div className="flex items-center justify-center gap-1 mb-1 opacity-90">
              <ShoppingBag className="h-3 w-3 text-blue-600 dark:text-blue-400" />
              <span className="text-[10px] text-blue-700 dark:text-blue-300 font-medium">
                Orders
              </span>
            </div>
            <div className="text-base font-bold text-blue-900 dark:text-blue-100 leading-none">
              {dashboardData.orders.value}
            </div>
          </div>

          {/* Visits - Slate/Sky (Clean) */}
          <div className="bg-slate-50/80 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 p-2 text-center flex flex-col justify-center h-20">
            <div className="flex items-center justify-center gap-1 mb-1 opacity-90">
              <Globe className="h-3 w-3 text-slate-600 dark:text-slate-400" />
              <span className="text-[10px] text-slate-700 dark:text-slate-300 font-medium">
                Visits
              </span>
            </div>
            <div className="text-base font-bold text-slate-900 dark:text-slate-100 leading-none">
              {dashboardData.activeNow.value}
            </div>
          </div>

          {/* AOV - Amber (Accent Yellow) */}
          <div className="bg-amber-50/80 dark:bg-amber-950/20 rounded-xl border border-amber-100 dark:border-amber-900 p-2 text-center flex flex-col justify-center h-20">
            <div className="flex items-center justify-center gap-1 mb-1 opacity-90">
              <Activity className="h-3 w-3 text-amber-600 dark:text-amber-400" />
              <span className="text-[10px] text-amber-700 dark:text-amber-300 font-medium whitespace-nowrap">
                Avg. Order
              </span>
            </div>
            <div className="text-sm font-bold text-amber-900 dark:text-amber-100 leading-none">
              {
                formatPrice(dashboardData.aov, merchant?.country || null).split(
                  '.'
                )[0]
              }
            </div>
          </div>

          {/* Customers - Sky/Blue (Secondary Blue) */}
          <div className="bg-sky-50/80 dark:bg-sky-950/20 rounded-xl border border-sky-100 dark:border-sky-900 p-2 text-center flex flex-col justify-center h-20">
            <div className="flex items-center justify-center gap-1 mb-1 opacity-90">
              <Users className="h-3 w-3 text-sky-600 dark:text-sky-400" />
              <span className="text-[10px] text-sky-700 dark:text-sky-300 font-medium">
                New
              </span>
            </div>
            <div className="text-base font-bold text-sky-900 dark:text-sky-100 leading-none">
              {dashboardData.customers.value}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Quick Actions</h3>
          <div className="grid grid-cols-4 gap-3">
            <Button
              variant="ghost"
              className="h-auto flex-col gap-2 p-3 bg-muted/50 rounded-xl"
              asChild
            >
              <a href="/dashboard/products/new">
                <Package className="h-5 w-5 text-primary" />
                <span className="text-[10px] text-muted-foreground">
                  Add Product
                </span>
              </a>
            </Button>
            <Button
              variant="ghost"
              className="h-auto flex-col gap-2 p-3 bg-muted/50 rounded-xl"
              asChild
            >
              <a href="/dashboard/orders">
                <ShoppingBag className="h-5 w-5 text-primary" />
                <span className="text-[10px] text-muted-foreground">
                  View Orders
                </span>
              </a>
            </Button>
            <Button
              variant="ghost"
              className="h-auto flex-col gap-2 p-3 bg-muted/50 rounded-xl"
              asChild
            >
              <a href="/dashboard/customers">
                <Users className="h-5 w-5 text-primary" />
                <span className="text-[10px] text-muted-foreground">
                  Customers
                </span>
              </a>
            </Button>
            <Button
              variant="ghost"
              className="h-auto flex-col gap-2 p-3 bg-muted/50 rounded-xl"
              asChild
            >
              <a href="/dashboard/analytics">
                <TrendingUp className="h-5 w-5 text-primary" />
                <span className="text-[10px] text-muted-foreground">
                  Insights
                </span>
              </a>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Bento Grid - Desktop only */}
      <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metrics */}
        <div
          className="min-w-[85vw] md:min-w-0 snap-center col-span-1 animate-in fade-in slide-in-from-bottom-4 duration-500"
          style={{ animationFillMode: 'both', animationDelay: '0.1s' }}
        >
          <BentoCard title="Total Revenue" icon={DollarSign}>
            <div className="mt-2 space-y-1">
              <div className="text-3xl font-bold tracking-tight">
                {formatPrice(
                  dashboardData.revenue.value,
                  merchant?.country || null
                )}
              </div>
              <div className="flex items-center text-xs text-green-500 font-medium">
                <ArrowUp className="mr-1 h-3 w-3" />
                {dashboardData.revenue.change}% from last month
              </div>
            </div>
            <div className="h-[60px] mt-4 -mx-2">
              <RevenueSparkline data={monthlyChartData} config={chartConfig} />
            </div>
          </BentoCard>
        </div>

        <div
          className="min-w-[85vw] md:min-w-0 snap-center col-span-1 animate-in fade-in slide-in-from-bottom-4 duration-500"
          style={{ animationFillMode: 'both', animationDelay: '0.2s' }}
        >
          <BentoCard title="Active Orders" icon={ShoppingBag}>
            <div className="mt-2 space-y-1">
              <div className="text-3xl font-bold tracking-tight">
                +{dashboardData.orders.value.toLocaleString()}
              </div>
              <div className="flex items-center text-xs text-green-500 font-medium">
                <ArrowUp className="mr-1 h-3 w-3" />
                {dashboardData.orders.change}% from last month
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className="h-2 flex-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${dashboardData.fulfillmentRate}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {dashboardData.fulfillmentRate}% fulfilled
              </span>
            </div>
          </BentoCard>
        </div>

        <div
          className="min-w-[85vw] md:min-w-0 snap-center col-span-1 animate-in fade-in slide-in-from-bottom-4 duration-500"
          style={{ animationFillMode: 'both', animationDelay: '0.3s' }}
        >
          <BentoCard title="Customers" icon={Users}>
            <div className="mt-2 space-y-1">
              <div className="text-3xl font-bold tracking-tight">
                +{dashboardData.customers.value.toLocaleString()}
              </div>
              <div className="flex items-center text-xs text-green-500 font-medium">
                <ArrowUp className="mr-1 h-3 w-3" />
                {dashboardData.customers.change}% from last month
              </div>
            </div>
            <div className="mt-4 flex -space-x-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-8 w-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-medium"
                >
                  {String.fromCharCode(64 + i)}
                </div>
              ))}
              {dashboardData.customers.value > 4 && (
                <div className="h-8 w-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground">
                  +
                  {dashboardData.customers.value > 1000
                    ? `${Math.floor(dashboardData.customers.value / 1000)}k`
                    : dashboardData.customers.value - 4}
                </div>
              )}
            </div>
          </BentoCard>
        </div>

        <div
          className="min-w-[85vw] md:min-w-0 snap-center col-span-1 animate-in fade-in slide-in-from-bottom-4 duration-500"
          style={{ animationFillMode: 'both', animationDelay: '0.4s' }}
        >
          <BentoCard title="Avg. Order Value" icon={Activity}>
            <div className="mt-2 space-y-1">
              <div className="text-3xl font-bold tracking-tight">
                {formatPrice(dashboardData.aov, merchant?.country || null)}
              </div>
              <div className="flex items-center text-xs text-muted-foreground">
                <TrendingUp className="mr-1 h-3 w-3" />
                Per transaction
              </div>
            </div>
            <div className="h-[60px] mt-4 flex items-end justify-between gap-1">
              {monthlyChartData.length > 0
                ? monthlyChartData.map((data, _i) => {
                    const maxRevenue = Math.max(
                      ...monthlyChartData.map((d) => d.revenue)
                    );
                    const height =
                      maxRevenue > 0 ? (data.revenue / maxRevenue) * 100 : 0;
                    return (
                      <div
                        key={data.month}
                        className="w-full bg-primary/30 rounded-t-sm transition-all"
                        style={{ height: `${height}%` }}
                        title={`${data.month}: ${formatPrice(data.revenue, merchant?.country || null)}`}
                      />
                    );
                  })
                : [40, 25, 60, 30, 70, 45].map((h, i) => (
                    <div
                      // biome-ignore lint/suspicious/noArrayIndexKey: List is static
                      key={i}
                      className="w-full bg-primary/20 rounded-t-sm"
                      style={{ height: `${h}%` }}
                    />
                  ))}
            </div>
          </BentoCard>
        </div>
      </div>

      {/* Detailed Charts & Lists - Standard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Big Chart */}
        <div
          className="col-span-1 md:col-span-2 lg:col-span-3 row-span-2 animate-in fade-in slide-in-from-bottom-4 duration-500"
          style={{ animationFillMode: 'both', animationDelay: '0.5s' }}
        >
          <BentoCard
            title="Revenue Overview"
            icon={TrendingUp}
            className="h-full min-h-[300px] md:min-h-[400px]"
          >
            <div className="h-full w-full pt-4">
              <RevenueBarChart
                data={monthlyChartData}
                config={chartConfig}
                country={merchant?.country || null}
              />
            </div>
          </BentoCard>
        </div>

        {/* Recent Sales List */}
        <div
          className="col-span-1 md:col-span-2 lg:col-span-1 row-span-2 animate-in fade-in slide-in-from-bottom-4 duration-500"
          style={{ animationFillMode: 'both', animationDelay: '0.6s' }}
        >
          <BentoCard
            title="Recent Sales"
            icon={CreditCard}
            className="h-full overflow-hidden"
          >
            <div className="space-y-3 mt-2">
              {recentSales.map((sale) => (
                <div
                  key={sale.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors overflow-hidden"
                >
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary shrink-0">
                    {sale.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className="text-sm font-medium leading-none truncate">
                      {sale.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {sale.email}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium whitespace-nowrap">
                      +{formatPrice(sale.amount, merchant?.country || null)}
                    </p>
                    <p
                      className={cn(
                        'text-[10px] font-medium',
                        sale.status === 'Completed'
                          ? 'text-green-500'
                          : sale.status === 'Processing'
                            ? 'text-blue-500'
                            : 'text-red-500'
                      )}
                    >
                      {sale.status}
                    </p>
                  </div>
                </div>
              ))}
              <Button
                variant="ghost"
                className="w-full text-xs text-muted-foreground hover:text-foreground"
              >
                View All Transactions <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </BentoCard>
        </div>
      </div>
    </div>
  );
}
