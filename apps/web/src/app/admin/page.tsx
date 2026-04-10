'use client';

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Banknote,
  Building2,
  CheckCircle,
  DollarSign,
  RefreshCw,
  TrendingUp,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AnalyticsCard } from '@/components/analytics/analytics-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  formatAdminCompactCurrency,
  formatAdminCurrency,
} from '@/lib/admin-currency';
import { fetchWithCsrf } from '@/lib/api-client';
import type { PlatformAnalytics } from '@/types/analytics';
import { OrderPipelineBreakdowns } from './order-pipeline-breakdowns';
import { PlatformPerformanceBreakdowns } from './platform-performance-breakdowns';

const HEALTH_COLORS = {
  healthy: '#10b981',
  atRisk: '#f59e0b',
  churned: '#ef4444',
  new: '#6366f1',
};

function formatCurrency(value: number): string {
  return value >= 1000
    ? formatAdminCompactCurrency(value)
    : formatAdminCurrency(value);
}

function formatNumber(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toString();
}

const PERIOD_LABELS: Record<'7d' | '30d' | '90d' | 'all', string> = {
  '7d': 'last 7 days',
  '30d': 'last 30 days',
  '90d': 'last 90 days',
  all: 'all time',
};

function getPeriodLabel(period: '7d' | '30d' | '90d' | 'all'): string {
  return PERIOD_LABELS[period];
}

export default function AdminDashboardPage() {
  const [analytics, setAnalytics] = useState<PlatformAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | 'all'>('all');
  const { toast } = useToast();

  const fetchAnalytics = async ({
    showErrorToast = true,
    successToast,
    throwOnError = false,
  }: {
    showErrorToast?: boolean;
    successToast?: {
      description: string;
      title: string;
    };
    throwOnError?: boolean;
  } = {}) => {
    try {
      const response = await fetch(`/api/admin/analytics?period=${period}`);
      if (!response.ok) throw new Error('Failed to fetch analytics');
      const data = await response.json();
      setAnalytics(data);
      if (successToast) {
        toast(successToast);
      }
      return data;
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      if (showErrorToast) {
        toast({
          title: 'Error',
          description: 'Failed to load platform analytics.',
          variant: 'destructive',
        });
      }
      if (throwOnError) {
        throw error;
      }
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshViews = async () => {
    try {
      setRefreshing(true);
      const response = await fetchWithCsrf('/api/admin/analytics', {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to refresh');
      await fetchAnalytics({
        showErrorToast: false,
        successToast: {
          title: 'Data Refreshed',
          description: 'Platform analytics have been updated.',
        },
        throwOnError: true,
      });
    } catch (error) {
      console.error('Failed to refresh views:', error);
      toast({
        title: 'Error',
        description: 'Failed to refresh analytics views.',
        variant: 'destructive',
      });
    } finally {
      setRefreshing(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: React Compiler handles memoization
  useEffect(() => {
    fetchAnalytics();
  }, [period, toast]);

  const healthData = analytics
    ? [
        {
          name: 'Healthy',
          value: analytics.merchantHealth.healthy,
          color: HEALTH_COLORS.healthy,
        },
        {
          name: 'At Risk',
          value: analytics.merchantHealth.atRisk,
          color: HEALTH_COLORS.atRisk,
        },
        {
          name: 'Churned',
          value: analytics.merchantHealth.churned,
          color: HEALTH_COLORS.churned,
        },
        {
          name: 'New',
          value: analytics.merchantHealth.new,
          color: HEALTH_COLORS.new,
        },
      ].filter((d) => d.value > 0)
    : [];

  const chartData =
    analytics?.dailyGmv.map((d) => ({
      date: new Date(d.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      gmv: d.gmv,
      orders: d.orders,
      merchants: d.merchants,
    })) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-page-title">Platform Overview</h1>
          <p className="text-muted-foreground">
            Monitor your platform&apos;s health, growth, and merchant activity.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border bg-background p-1">
            {(['7d', '30d', '90d', 'all'] as const).map((p) => (
              <Button
                key={p}
                variant={period === p ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setPeriod(p)}
                className="text-xs"
              >
                {p === '7d'
                  ? '7 Days'
                  : p === '30d'
                    ? '30 Days'
                    : p === '90d'
                      ? '90 Days'
                      : 'All'}
              </Button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshViews}
            disabled={refreshing}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${refreshing ? 'motion-safe:animate-spin' : ''}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          [...Array(4)].map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: Skeleton
            <Card key={i} className="p-6">
              <Skeleton className="h-4 w-24 mb-4" />
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-4 w-20" />
            </Card>
          ))
        ) : analytics ? (
          <>
            <AnalyticsCard
              title="Paid GMV"
              value={formatCurrency(analytics.summary.totalGmv)}
              change={Math.abs(analytics.summary.gmvChange)}
              trend={analytics.summary.gmvChange >= 0 ? 'up' : 'down'}
              icon={DollarSign}
              description={`Gross order value ${formatCurrency(analytics.summary.grossGmv)}`}
            />
            <AnalyticsCard
              title="Active Merchants"
              value={analytics.summary.activeMerchants}
              change={Math.abs(analytics.growth.merchantGrowthRate)}
              trend={analytics.growth.merchantGrowthRate >= 0 ? 'up' : 'down'}
              icon={Building2}
              description={`of ${analytics.summary.totalMerchants} total`}
            />
            <AnalyticsCard
              title="Paid Orders"
              value={formatNumber(analytics.summary.totalOrders)}
              icon={Activity}
              description={`Of ${formatNumber(analytics.summary.grossOrders)} created ${period === 'all' ? 'all time' : `in last ${period}`}`}
            />
            <AnalyticsCard
              title="Avg GMV/Merchant"
              value={formatCurrency(analytics.summary.avgGmvPerMerchant)}
              icon={TrendingUp}
              description="Per active merchant"
            />
          </>
        ) : null}
      </div>

      {/* Platform Revenue Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {loading ? (
          [...Array(3)].map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: Skeleton
            <Card key={i} className="p-6">
              <Skeleton className="h-4 w-24 mb-4" />
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-4 w-20" />
            </Card>
          ))
        ) : analytics ? (
          <>
            <Card className="border-emerald-500/20 bg-emerald-500/5">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="p-3 rounded-full bg-emerald-500/10">
                  <Banknote className="h-6 w-6 text-emerald-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground font-medium">
                    Platform Revenue
                  </p>
                  <p className="text-2xl font-bold text-emerald-600">
                    {formatCurrency(analytics.summary.platformRevenue)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Fees collected from paid orders
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-orange-500/20 bg-orange-500/5">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="p-3 rounded-full bg-orange-500/10">
                  <DollarSign className="h-6 w-6 text-orange-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground font-medium">
                    Processor Fees
                  </p>
                  <p className="text-2xl font-bold text-orange-600">
                    {formatCurrency(analytics.summary.processorFees)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Payment processor costs
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-blue-500/20 bg-blue-500/5">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="p-3 rounded-full bg-blue-500/10">
                  <Wallet className="h-6 w-6 text-blue-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground font-medium">
                    Net to Merchants
                  </p>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(analytics.summary.netToMerchants)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    After platform & processor fees
                  </p>
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* GMV Chart */}
        <Card className="glass lg:col-span-2">
          <CardHeader>
            <CardTitle>Paid GMV Over Time</CardTitle>
            <CardDescription>
              Daily paid GMV across non-admin merchants
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%" debounce={100}>
                  <AreaChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorGmv" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor="#6366f1"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="#6366f1"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="currentColor"
                      className="text-muted/20"
                    />
                    <XAxis
                      dataKey="date"
                      stroke="currentColor"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      className="text-muted-foreground"
                    />
                    <YAxis
                      stroke="currentColor"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => formatCurrency(value)}
                      className="text-muted-foreground"
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload?.length) {
                          return (
                            <div className="rounded-xl border bg-background/95 backdrop-blur-sm p-3 shadow-xl">
                              <p className="text-xs font-medium text-muted-foreground mb-1">
                                {label}
                              </p>
                              <p className="text-lg font-bold">
                                {formatCurrency(payload[0].value as number)}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="gmv"
                      stroke="#6366f1"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorGmv)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Merchant Health */}
        <Card className="glass">
          <CardHeader>
            <CardTitle>Merchant Health</CardTitle>
            <CardDescription>Distribution by activity status</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : healthData.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%" debounce={100}>
                  <PieChart>
                    <Pie
                      data={healthData}
                      cx="50%"
                      cy="45%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                      stroke="none"
                    >
                      {healthData.map((entry) => (
                        <Cell key={`cell-${entry.name}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload?.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="rounded-xl border bg-background/95 backdrop-blur-sm p-3 shadow-xl">
                              <p className="text-sm font-medium">{data.name}</p>
                              <p className="text-lg font-bold">
                                {data.value} merchants
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      iconType="circle"
                      formatter={(value) => (
                        <span className="text-xs font-medium text-muted-foreground ml-1">
                          {value}
                        </span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No merchant data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Merchant Health Quick Actions */}
      <div className="grid gap-4 md:grid-cols-4">
        <Link href="/admin/merchants?health=healthy">
          <Card className="border-emerald-500/20 bg-emerald-500/5 cursor-pointer hover:bg-emerald-500/10 transition-colors">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-2 rounded-full bg-emerald-500/10">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {analytics?.merchantHealth.healthy || 0}
                </p>
                <p className="text-sm text-muted-foreground">
                  Healthy Merchants
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/merchants?health=at_risk">
          <Card className="border-amber-500/20 bg-amber-500/5 cursor-pointer hover:bg-amber-500/10 transition-colors">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-2 rounded-full bg-amber-500/10">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {analytics?.merchantHealth.atRisk || 0}
                </p>
                <p className="text-sm text-muted-foreground">At Risk</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/merchants?health=churned">
          <Card className="border-red-500/20 bg-red-500/5 cursor-pointer hover:bg-red-500/10 transition-colors">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-2 rounded-full bg-red-500/10">
                <XCircle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {analytics?.merchantHealth.churned || 0}
                </p>
                <p className="text-sm text-muted-foreground">Churned</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/merchants?health=new">
          <Card className="border-indigo-500/20 bg-indigo-500/5 cursor-pointer hover:bg-indigo-500/10 transition-colors">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="p-2 rounded-full bg-indigo-500/10">
                <Users className="h-5 w-5 text-indigo-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {analytics?.merchantHealth.new || 0}
                </p>
                <p className="text-sm text-muted-foreground">
                  New (No Sales Yet)
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <PlatformPerformanceBreakdowns
        businessTypes={analytics?.businessTypes || []}
        loading={loading}
        merchantActivation={analytics?.merchantActivation || []}
        periodLabel={getPeriodLabel(period)}
        salesByChannel={analytics?.salesByChannel || []}
        signupSources={analytics?.signupSources || []}
      />

      <OrderPipelineBreakdowns
        loading={loading}
        paymentMethods={analytics?.paymentMethods || []}
        paymentStatuses={analytics?.paymentStatuses || []}
        periodLabel={getPeriodLabel(period)}
        shippingStatuses={analytics?.shippingStatuses || []}
      />

      {/* Top Merchants */}
      <Card className="glass">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Top Performing Merchants</CardTitle>
            <CardDescription>
              By GMV in the {getPeriodLabel(period)}
            </CardDescription>
          </div>
          <Link href="/admin/merchants">
            <Button variant="outline" size="sm">
              View All
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: Skeleton
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-32 mb-2" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : analytics?.topMerchants.length ? (
            <div className="space-y-4">
              {analytics.topMerchants.slice(0, 5).map((merchant, index) => (
                <div
                  key={merchant.id}
                  className="flex items-center gap-4 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{merchant.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {merchant.orders} orders
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-sm font-semibold">
                    {formatCurrency(merchant.gmv)}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No merchant data available yet
            </div>
          )}
        </CardContent>
      </Card>

      {/* Footer with last updated */}
      {analytics && (
        <p className="text-xs text-muted-foreground text-center">
          Last updated: {new Date(analytics.generatedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}
