import { getMerchantForUser } from '@/lib/merchant-server';
import {
  getDashboardMetrics,
  getMonthlyChartData,
  getRecentSales,
} from './actions';
import DashboardClientPage from './client-page';

// Configuration constants
const RECENT_SALES_LIMIT = 5;

// Sanitize error output to avoid leaking sensitive info
function sanitizeError(reason: unknown): string {
  if (
    reason &&
    typeof reason === 'object' &&
    'message' in reason &&
    typeof (reason as { message: unknown }).message === 'string'
  ) {
    return (reason as { message: string }).message;
  }
  if (typeof reason === 'string') {
    return reason;
  }
  return 'Unknown error';
}

export async function DashboardData() {
  const { merchant } = await getMerchantForUser();

  if (!merchant) {
    return <DashboardClientPage />;
  }

  // Use Promise.allSettled to handle partial failures gracefully
  const [metricsResult, recentSalesResult, chartDataResult] =
    await Promise.allSettled([
      getDashboardMetrics(merchant.id),
      getRecentSales(merchant.id, RECENT_SALES_LIMIT),
      getMonthlyChartData(merchant.id),
    ]);

  const metrics =
    metricsResult.status === 'fulfilled' ? metricsResult.value : null;
  const recentSales =
    recentSalesResult.status === 'fulfilled' ? recentSalesResult.value : [];
  const monthlyChartData =
    chartDataResult.status === 'fulfilled' ? chartDataResult.value : [];

  // Log any errors for debugging with sanitized output
  if (metricsResult.status === 'rejected') {
    console.error(
      'Failed to fetch dashboard metrics:',
      sanitizeError(metricsResult.reason)
    );
  }
  if (recentSalesResult.status === 'rejected') {
    console.error(
      'Failed to fetch recent sales:',
      sanitizeError(recentSalesResult.reason)
    );
  }
  if (chartDataResult.status === 'rejected') {
    console.error(
      'Failed to fetch chart data:',
      sanitizeError(chartDataResult.reason)
    );
  }
  return (
    <DashboardClientPage
      initialMetrics={metrics ?? undefined}
      initialRecentSales={recentSales}
      initialChartData={monthlyChartData}
    />
  );
}
