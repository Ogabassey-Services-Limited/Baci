import {
  Activity,
  ArrowUp,
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Users,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { BentoCard } from '@/components/ui/bento-card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatPrice } from '@/lib/currency-utils';
import type { DashboardMetrics, MonthlyChartData } from './actions';
import { dashboardChartConfig } from './dashboard-page-chart-config';

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

interface DashboardPageMetricsProps {
  country: string | null;
  dashboardData: DashboardMetrics;
  monthlyChartData: MonthlyChartData[];
}

export function DashboardPageMetrics({
  country,
  dashboardData,
  monthlyChartData,
}: DashboardPageMetricsProps) {
  return (
    <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div
        className="col-span-1 animate-in fade-in slide-in-from-bottom-4 duration-500"
        style={{ animationFillMode: 'both', animationDelay: '0.1s' }}
      >
        <BentoCard title="30-Day Paid Revenue" icon={DollarSign}>
          <div className="mt-2 space-y-1">
            <div className="text-3xl font-bold tracking-tight">
              {formatPrice(dashboardData.revenue.value, country)}
            </div>
            <div className="flex items-center text-xs text-green-500 font-medium">
              <ArrowUp className="mr-1 size-3" />
              {dashboardData.revenue.change}% from last month
            </div>
          </div>
          <div className="h-[60px] mt-4 -mx-2">
            <RevenueSparkline
              data={monthlyChartData}
              config={dashboardChartConfig}
            />
          </div>
        </BentoCard>
      </div>

      <div
        className="col-span-1 animate-in fade-in slide-in-from-bottom-4 duration-500"
        style={{ animationFillMode: 'both', animationDelay: '0.2s' }}
      >
        <BentoCard title="30-Day Paid Orders" icon={ShoppingBag}>
          <div className="mt-2 space-y-1">
            <div className="text-3xl font-bold tracking-tight">
              {dashboardData.orders.value.toLocaleString()}
            </div>
            <div className="flex items-center text-xs text-green-500 font-medium">
              <ArrowUp className="mr-1 size-3" />
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
        <BentoCard title="30-Day Customers" icon={Users}>
          <div className="mt-2 space-y-1">
            <div className="text-3xl font-bold tracking-tight">
              +{dashboardData.customers.value.toLocaleString()}
            </div>
            <div className="flex items-center text-xs text-green-500 font-medium">
              <ArrowUp className="mr-1 size-3" />
              {dashboardData.customers.change}% from last month
            </div>
          </div>
          <div className="mt-4 flex -space-x-2">
            {[1, 2, 3, 4].map((index) => (
              <div
                key={index}
                className="size-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-medium"
              >
                {String.fromCharCode(64 + index)}
              </div>
            ))}
            {dashboardData.customers.value > 4 && (
              <div className="size-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground">
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
              {formatPrice(dashboardData.aov, country)}
            </div>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingUp className="mr-1 size-3" />
              Per transaction
            </div>
          </div>
          <div className="h-[60px] mt-4 flex items-end justify-between gap-1">
            {monthlyChartData.length > 0 ? (
              <RevenueBars country={country} data={monthlyChartData} />
            ) : (
              [40, 25, 60, 30, 70, 45].map((height, index) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: List is static
                  key={index}
                  className="w-full bg-primary/20 rounded-t-sm"
                  style={{ height: `${height}%` }}
                />
              ))
            )}
          </div>
        </BentoCard>
      </div>
    </div>
  );
}

function RevenueBars({
  country,
  data,
}: {
  country: string | null;
  data: MonthlyChartData[];
}) {
  const maxRevenue = Math.max(...data.map((item) => item.revenue));

  return data.map((item) => {
    const height = maxRevenue > 0 ? (item.revenue / maxRevenue) * 100 : 0;
    return (
      <div
        key={item.month}
        className="w-full bg-primary/30 rounded-t-sm transition-all"
        style={{ height: `${height}%` }}
        title={`${item.month}: ${formatPrice(item.revenue, country)}`}
      />
    );
  });
}
