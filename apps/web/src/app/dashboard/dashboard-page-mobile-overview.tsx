import {
  Activity,
  Globe,
  Package,
  ShoppingBag,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/currency-utils';
import type { DashboardMetrics } from './actions';

interface DashboardPageMobileOverviewProps {
  country: string | null;
  dashboardData: DashboardMetrics;
}

export function DashboardPageMobileOverview({
  country,
  dashboardData,
}: DashboardPageMobileOverviewProps) {
  return (
    <div className="md:hidden space-y-4">
      <div className="grid grid-cols-4 gap-2 my-4">
        <div className="bg-blue-50/80 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900 p-2 text-center flex flex-col justify-center h-20">
          <div className="flex items-center justify-center gap-1 mb-1 opacity-90">
            <ShoppingBag className="size-3 text-blue-600 dark:text-blue-400" />
            <span
              className="text-[10px] text-blue-700 dark:text-blue-300 font-medium"
              title="30-Day Paid Orders"
            >
              30D Paid
            </span>
          </div>
          <div className="text-base font-bold text-blue-900 dark:text-blue-100 leading-none">
            {dashboardData.orders.value}
          </div>
        </div>

        <div className="bg-slate-50/80 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 p-2 text-center flex flex-col justify-center h-20">
          <div className="flex items-center justify-center gap-1 mb-1 opacity-90">
            <Globe className="size-3 text-slate-600 dark:text-slate-400" />
            <span className="text-[10px] text-slate-700 dark:text-slate-300 font-medium">
              Visits
            </span>
          </div>
          <div className="text-base font-bold text-slate-900 dark:text-slate-100 leading-none">
            {dashboardData.activeNow.value}
          </div>
        </div>

        <div className="bg-amber-50/80 dark:bg-amber-950/20 rounded-xl border border-amber-100 dark:border-amber-900 p-2 text-center flex flex-col justify-center h-20">
          <div className="flex items-center justify-center gap-1 mb-1 opacity-90">
            <Activity className="size-3 text-amber-600 dark:text-amber-400" />
            <span className="text-[10px] text-amber-700 dark:text-amber-300 font-medium whitespace-nowrap">
              Avg. Order
            </span>
          </div>
          <div className="text-sm font-bold text-amber-900 dark:text-amber-100 leading-none">
            {formatPrice(dashboardData.aov, country).split('.')[0]}
          </div>
        </div>

        <div className="bg-sky-50/80 dark:bg-sky-950/20 rounded-xl border border-sky-100 dark:border-sky-900 p-2 text-center flex flex-col justify-center h-20">
          <div className="flex items-center justify-center gap-1 mb-1 opacity-90">
            <Users className="size-3 text-sky-600 dark:text-sky-400" />
            <span
              className="text-[10px] text-sky-700 dark:text-sky-300 font-medium"
              title="30-Day Customers"
            >
              30D New
            </span>
          </div>
          <div className="text-base font-bold text-sky-900 dark:text-sky-100 leading-none">
            {dashboardData.customers.value}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Quick Actions</h3>
        <div className="grid grid-cols-4 gap-3">
          <Button
            variant="ghost"
            className="h-auto flex-col gap-2 p-3 bg-muted/50 rounded-xl"
            asChild
          >
            <a href="/dashboard/products/new">
              <Package className="size-5 text-primary" />
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
              <ShoppingBag className="size-5 text-primary" />
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
              <Users className="size-5 text-primary" />
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
              <TrendingUp className="size-5 text-primary" />
              <span className="text-[10px] text-muted-foreground">
                Insights
              </span>
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
