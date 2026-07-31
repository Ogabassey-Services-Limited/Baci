import { ArrowRight, Sparkles } from 'lucide-react';
import { BentoCard } from '@/components/ui/bento-card';
import { Button } from '@/components/ui/button';
import type { DashboardMetrics } from './actions';

interface DashboardPageInsightsProps {
  businessName?: string | null;
  dashboardData: DashboardMetrics;
  isPublished?: boolean | null;
  slug?: string | null;
}

export function DashboardPageInsights({
  businessName,
  dashboardData,
  isPublished,
  slug,
}: DashboardPageInsightsProps) {
  if (!isPublished) return null;

  return (
    <>
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
              <Sparkles className="size-8" />
            </div>
            <div className="space-y-2 flex-1">
              <h2 className="text-xl font-semibold">
                Good morning,{' '}
                <span className="capitalize">
                  {slug || businessName || 'Merchant'}
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

      <div className="md:hidden mb-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-gradient-to-r from-blue-50 to-white dark:from-blue-950/20 dark:to-background border border-blue-100 dark:border-blue-900 rounded-xl p-3 flex items-center gap-3 shadow-sm">
          <div className="size-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center shrink-0">
            <Sparkles className="size-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-medium truncate">
              Good morning,{' '}
              <span className="capitalize">
                {businessName?.split(' ')[0] || 'Merchant'}
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
          <Button size="icon" variant="ghost" className="size-8 shrink-0 -mr-1">
            <ArrowRight className="size-4 text-muted-foreground" />
          </Button>
        </div>
      </div>
    </>
  );
}
