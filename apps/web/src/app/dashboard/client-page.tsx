'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useMerchant } from '@/hooks/use-merchant-client';
import { useToast } from '@/hooks/use-toast';
import {
  type DashboardMetrics,
  getDashboardMetrics,
  getMonthlyChartData,
  getRecentSales,
  type MonthlyChartData,
  type RecentSale,
} from './actions';
import { DashboardPageHeader } from './dashboard-page-header';
import { DashboardPageInsights } from './dashboard-page-insights';
import { DashboardPageMetrics } from './dashboard-page-metrics';
import { DashboardPageMobileOverview } from './dashboard-page-mobile-overview';
import { DashboardPagePerformance } from './dashboard-page-performance';
import { DashboardPageReadiness } from './dashboard-page-readiness';
import { useDashboardPublishToggle } from './use-dashboard-publish-toggle';

interface DashboardClientPageProps {
  initialMetrics?: DashboardMetrics;
  initialRecentSales?: RecentSale[];
  initialChartData?: MonthlyChartData[];
}

const emptyDashboardMetrics: DashboardMetrics = {
  revenue: { value: 0, change: 0 },
  customers: { value: 0, change: 0 },
  orders: { value: 0, change: 0 },
  activeNow: { value: 0, change: 0 },
  fulfillmentRate: 0,
  aov: 0,
};

// biome-ignore lint/suspicious/noEmptyBlockStatements: intentional noop subscription
const emptySubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

function useIsMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    getClientSnapshot,
    getServerSnapshot
  );
}

export default function DashboardClientPage({
  initialMetrics,
  initialRecentSales,
  initialChartData,
}: DashboardClientPageProps) {
  const { merchant, reloadMerchant } = useMerchant();
  const router = useRouter();
  const { toast } = useToast();
  const mounted = useIsMounted();
  const { isPublishing, togglePublish } = useDashboardPublishToggle({
    isPublished: merchant?.is_published,
    merchantId: merchant?.id,
    refresh: router.refresh,
    reloadMerchant,
    toast,
  });
  const [dashboardData, setDashboardData] = useState<DashboardMetrics>(
    initialMetrics ?? emptyDashboardMetrics
  );
  const [recentSales, setRecentSales] = useState<RecentSale[]>(
    initialRecentSales ?? []
  );
  const [monthlyChartData, setMonthlyChartData] = useState<MonthlyChartData[]>(
    initialChartData ?? []
  );

  useEffect(() => {
    if (initialMetrics && initialRecentSales && initialChartData) return;
    if (!merchant?.id) return;

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
  }, [merchant?.id, initialMetrics, initialRecentSales, initialChartData]);

  if (!mounted) return null;

  return (
    <div className="space-y-6 p-3 md:p-6 pb-24 md:pb-8 overflow-x-hidden">
      <DashboardPageHeader
        businessName={merchant?.business_name}
        isPublished={merchant?.is_published}
        isPublishing={isPublishing}
        onPublishToggle={togglePublish}
        slug={merchant?.slug}
      />
      <DashboardPageReadiness merchantId={merchant?.id} />
      <DashboardPageInsights
        businessName={merchant?.business_name}
        dashboardData={dashboardData}
        isPublished={merchant?.is_published}
        slug={merchant?.slug}
      />
      <DashboardPageMobileOverview
        country={merchant?.country ?? null}
        dashboardData={dashboardData}
      />
      <DashboardPageMetrics
        country={merchant?.country ?? null}
        dashboardData={dashboardData}
        monthlyChartData={monthlyChartData}
      />
      <DashboardPagePerformance
        country={merchant?.country ?? null}
        monthlyChartData={monthlyChartData}
        recentSales={recentSales}
      />
    </div>
  );
}
