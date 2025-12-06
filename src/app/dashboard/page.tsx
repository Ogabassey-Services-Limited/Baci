import { getMerchantForUser } from '@/lib/merchant-server';
import {
  getDashboardMetrics,
  getMonthlyChartData,
  getRecentSales,
} from './actions';
import DashboardClientPage from './client-page';

export const metadata = {
  title: 'Dashboard - Baci',
};

// Configuration constants
const RECENT_SALES_LIMIT = 5;

// Promise configurations for dashboard data fetching
const createPromiseConfigs = (merchantId: string) => [
  { promise: () => getDashboardMetrics(merchantId), context: 'metrics' },
  {
    promise: () => getRecentSales(merchantId, RECENT_SALES_LIMIT),
    context: 'recentSales',
  },
  { promise: () => getMonthlyChartData(merchantId), context: 'monthlyChartData' },
];

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

export default async function DashboardPage() {
  const { merchant } = await getMerchantForUser();

  if (!merchant) {
    return <DashboardClientPage />;
  }

  const promiseConfigs = createPromiseConfigs(merchant.id);

  // Use Promise.allSettled to handle partial failures gracefully
  const results = await Promise.allSettled(
    promiseConfigs.map((cfg) => cfg.promise())
  );

  const metrics = results[0].status === 'fulfilled' ? results[0].value : null;
  const recentSales = results[1].status === 'fulfilled' ? results[1].value : [];
  const monthlyChartData =
    results[2].status === 'fulfilled' ? results[2].value : [];

  // Log any errors for debugging
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      const errorContext = promiseConfigs[index].context;
      // Log only a sanitized version of the error
      console.error(
        'Failed to fetch dashboard data:',
        errorContext,
        sanitizeError(result.reason)
      );
    }
  });

  return (
    <DashboardClientPage
      initialMetrics={metrics ?? undefined}
      initialRecentSales={recentSales}
      initialChartData={monthlyChartData}
    />
  );
}
