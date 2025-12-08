'use client';

import {
  Activity,
  ArrowRight,
  ArrowUp,
  CreditCard,
  DollarSign,
  Globe,
  Loader2,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { SetupChecklist } from '@/components/dashboard/setup-checklist';
import { BentoCard } from '@/components/ui/bento-card';
import { Button } from '@/components/ui/button';
import type { ChartConfig } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useMerchant } from '@/hooks/use-merchant';
import { formatPrice } from '@/lib/currency-utils';
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
  { ssr: false, loading: () => <Skeleton className="h-full w-full" /> }
);

const RevenueBarChart = dynamic(
  () =>
    import('@/components/dashboard/dashboard-charts').then(
      (mod) => mod.RevenueBarChart
    ),
  { ssr: false, loading: () => <Skeleton className="h-full w-full" /> }
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
}

export default function DashboardClientPage({
  initialMetrics,
  initialRecentSales,
  initialChartData,
}: DashboardClientPageProps) {
  const { merchant, reloadMerchant } = useMerchant();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
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
      const method = merchant?.is_published ? 'DELETE' : 'POST';
      const response = await fetch('/api/merchant/publish', { method });
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
    } catch (error) {
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
    <div className="space-y-6 p-6 pb-20">
      {/* Store Publish Status Banner */}
      <div
        className={cn(
          'rounded-lg border p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4',
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
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary via-purple-500 to-blue-600 bg-clip-text text-transparent">
            Dashboard
          </h1>
          <p className="text-muted-foreground">
            Overview of your store's performance
          </p>
        </div>
        <div className="flex items-center gap-2">
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
        <SetupChecklist dismissible />
      </div>

      {/* AI Insight Hero - Only show when store is published */}
      {merchant?.is_published && (
        <div
          className="animate-in fade-in slide-in-from-bottom-4 duration-500"
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
                <h3 className="text-xl font-semibold">
                  Good morning, {merchant?.business_name || 'Merchant'}!
                </h3>
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
              <Button variant="outline" className="shrink-0">
                View Insights
              </Button>
            </div>
          </BentoCard>
        </div>
      )}

      {/* Main Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metrics */}
        <div
          className="col-span-1 animate-in fade-in slide-in-from-bottom-4 duration-500"
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
          className="col-span-1 animate-in fade-in slide-in-from-bottom-4 duration-500"
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
          className="col-span-1 animate-in fade-in slide-in-from-bottom-4 duration-500"
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
          className="col-span-1 animate-in fade-in slide-in-from-bottom-4 duration-500"
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

        {/* Big Chart */}
        <div
          className="col-span-1 md:col-span-2 lg:col-span-3 row-span-2 animate-in fade-in slide-in-from-bottom-4 duration-500"
          style={{ animationFillMode: 'both', animationDelay: '0.5s' }}
        >
          <BentoCard
            title="Revenue Overview"
            icon={TrendingUp}
            className="h-full min-h-[400px]"
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
          <BentoCard title="Recent Sales" icon={CreditCard} className="h-full">
            <div className="space-y-4 mt-2">
              {recentSales.map((sale) => (
                <div
                  key={sale.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                      {sale.name.charAt(0)}
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium leading-none">
                        {sale.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {sale.email}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
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
