'use client';

import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  DollarSign,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { OrderPipelineBreakdowns } from '@/app/admin/order-pipeline-breakdowns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  formatAdminCompactCurrency,
  formatAdminCurrency,
} from '@/lib/admin-currency';
import type { PlatformAnalytics } from '@/types/analytics';

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

function formatPercentage(value: number): string {
  const formatted = Math.abs(value).toFixed(1);
  return `${formatted}%`;
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<PlatformAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const { toast } = useToast();

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/analytics?period=${period}`);
      if (!response.ok) throw new Error('Failed to fetch analytics');
      const data = (await response.json()) as PlatformAnalytics;
      setAnalytics(data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      toast({
        title: 'Error',
        description: 'Failed to load analytics data.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: React Compiler handles memoization
  useEffect(() => {
    fetchAnalytics();
  }, [period, toast]);

  const chartData =
    analytics?.dailyGmv.map((d) => ({
      date: new Date(d.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      gmv: d.gmv,
      orders: d.orders,
    })) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-page-title">Analytics</h1>
          <p className="text-muted-foreground">
            Deep dive into platform performance metrics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={period}
            onValueChange={(v) => setPeriod(v as typeof period)}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchAnalytics()}
            disabled={loading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? 'motion-safe:animate-spin' : ''}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          [...Array(4)].map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-32 mb-1" />
                <Skeleton className="h-4 w-16" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">
                    Paid GMV
                  </p>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold mt-2">
                  {formatCurrency(analytics?.summary.totalGmv || 0)}
                </p>
                <div className="flex items-center mt-1">
                  {(analytics?.summary.gmvChange || 0) >= 0 ? (
                    <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4 text-red-500" />
                  )}
                  <span
                    className={`text-sm ${(analytics?.summary.gmvChange || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}
                  >
                    {formatPercentage(analytics?.summary.gmvChange || 0)}
                  </span>
                  <span className="text-sm text-muted-foreground ml-1">
                    vs last period
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">
                    Paid Orders
                  </p>
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold mt-2">
                  {formatNumber(analytics?.summary.totalOrders || 0)}
                </p>
                <div className="flex items-center mt-1">
                  {(analytics?.summary.orderChange || 0) >= 0 ? (
                    <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4 text-red-500" />
                  )}
                  <span
                    className={`text-sm ${(analytics?.summary.orderChange || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}
                  >
                    {formatPercentage(analytics?.summary.orderChange || 0)}
                  </span>
                  <span className="text-sm text-muted-foreground ml-1">
                    vs last period
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">
                    Avg Order Value
                  </p>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold mt-2">
                  {formatCurrency(analytics?.summary.avgOrderValue || 0)}
                </p>
                <div className="flex items-center mt-1">
                  {(analytics?.summary.aovChange || 0) >= 0 ? (
                    <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4 text-red-500" />
                  )}
                  <span
                    className={`text-sm ${(analytics?.summary.aovChange || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}
                  >
                    {formatPercentage(analytics?.summary.aovChange || 0)}
                  </span>
                  <span className="text-sm text-muted-foreground ml-1">
                    vs last period
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">
                    Active Merchants
                  </p>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold mt-2">
                  {formatNumber(analytics?.summary.activeMerchants || 0)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  with sales this period
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* GMV Over Time */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              GMV Over Time
            </CardTitle>
            <CardDescription>
              Daily paid GMV from platform analytics
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
                    />
                    <YAxis
                      stroke="currentColor"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => formatCurrency(v)}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload?.length) {
                          return (
                            <div className="rounded-xl border bg-background/95 backdrop-blur-xs p-3 shadow-xl">
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
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorGmv)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Orders Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>Orders by Day</CardTitle>
            <CardDescription>Daily order volume</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : (
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%" debounce={100}>
                  <BarChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
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
                    />
                    <YAxis
                      stroke="currentColor"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload?.length) {
                          return (
                            <div className="rounded-xl border bg-background/95 backdrop-blur-xs p-3 shadow-xl">
                              <p className="text-xs font-medium text-muted-foreground mb-1">
                                {label}
                              </p>
                              <p className="text-lg font-bold">
                                {payload[0].value} orders
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="orders"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Merchant Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Merchant Performance</CardTitle>
            <CardDescription>GMV contribution by merchant</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : analytics?.topMerchants.length ? (
              <div className="space-y-4">
                {analytics.topMerchants.map((merchant, index) => (
                  <div key={merchant.name} className="flex items-center gap-4">
                    <div className="flex items-center gap-2 w-32 min-w-0">
                      <Badge variant="outline" className="shrink-0">
                        #{index + 1}
                      </Badge>
                      <span className="text-sm font-medium truncate">
                        {merchant.name}
                      </span>
                    </div>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{
                          width: `${Math.min(
                            analytics.summary.totalGmv > 0
                              ? (merchant.gmv / analytics.summary.totalGmv) *
                                  100
                              : 0,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium w-20 text-right">
                      {formatCurrency(merchant.gmv)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No merchant data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <OrderPipelineBreakdowns
        loading={loading}
        paymentMethods={analytics?.paymentMethods || []}
        paymentStatuses={analytics?.paymentStatuses || []}
        periodLabel={
          period === '7d'
            ? 'last 7 days'
            : period === '30d'
              ? 'last 30 days'
              : 'last 90 days'
        }
        shippingStatuses={analytics?.shippingStatuses || []}
      />
    </div>
  );
}
