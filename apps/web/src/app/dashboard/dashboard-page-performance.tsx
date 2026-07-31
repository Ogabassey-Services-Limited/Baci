import { ArrowRight, CreditCard, TrendingUp } from 'lucide-react';
import dynamic from 'next/dynamic';
import { BentoCard } from '@/components/ui/bento-card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatPrice } from '@/lib/currency-utils';
import { cn } from '@/lib/utils';
import type { MonthlyChartData, RecentSale } from './actions';
import { dashboardChartConfig } from './dashboard-page-chart-config';

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

interface DashboardPagePerformanceProps {
  country: string | null;
  monthlyChartData: MonthlyChartData[];
  recentSales: RecentSale[];
}

export function DashboardPagePerformance({
  country,
  monthlyChartData,
  recentSales,
}: DashboardPagePerformanceProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
              config={dashboardChartConfig}
              country={country}
            />
          </div>
        </BentoCard>
      </div>

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
                <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary shrink-0">
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
                    +{formatPrice(sale.amount, country)}
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
              View All Transactions <ArrowRight className="ml-1 size-3" />
            </Button>
          </div>
        </BentoCard>
      </div>
    </div>
  );
}
