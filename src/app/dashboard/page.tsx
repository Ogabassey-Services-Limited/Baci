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

export default async function DashboardPage() {
  const { merchant } = await getMerchantForUser();

  if (!merchant) {
    return <DashboardClientPage />;
  }

  // Use Promise.allSettled to handle partial failures gracefully
  const results = await Promise.allSettled([
    getDashboardMetrics(merchant.id),
    getRecentSales(merchant.id, 5),
    getMonthlyChartData(merchant.id),
  ]);

  const metrics = results[0].status === 'fulfilled' ? results[0].value : null;
  const recentSales = results[1].status === 'fulfilled' ? results[1].value : [];
  const monthlyChartData =
    results[2].status === 'fulfilled' ? results[2].value : [];

  // Log any errors for debugging (structured logging avoids format string injection)
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      const errorContext = ['metrics', 'recentSales', 'monthlyChartData'][
        index
      ];
      // Use separate arguments to avoid format string vulnerabilities
      console.error('Dashboard fetch failed:', errorContext, result.reason);
    }
  });

  return (
    <DashboardClientPage
      initialMetrics={metrics || undefined}
      initialRecentSales={recentSales}
      initialChartData={monthlyChartData}
    />
  );
}
