import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DashboardMetrics, MonthlyChartData } from './actions';
import DashboardClientPage from './client-page';

vi.mock('next/dynamic', () => ({
  default: () =>
    function DynamicChartStub() {
      return <div data-testid="dashboard-chart" />;
    },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock('@/components/dashboard/setup-checklist', () => ({
  SetupChecklist: () => <div data-testid="setup-checklist" />,
}));

vi.mock('@/components/dashboard/store-build-status-card', () => ({
  StoreBuildStatusCard: () => <div data-testid="store-build-status-card" />,
}));

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchant: () => ({
    merchant: {
      business_name: 'Demo Store',
      country: 'NG',
      id: 'merchant-1',
      is_published: true,
      slug: 'demo-store',
    },
    reloadMerchant: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/merchant-publish-client', () => ({
  requestMerchantPublish: vi.fn(),
}));

const metrics: DashboardMetrics = {
  activeNow: { change: 0, value: 7 },
  aov: 12500,
  customers: { change: 12, value: 9 },
  fulfillmentRate: 80,
  orders: { change: 20, value: 5 },
  revenue: { change: 15, value: 75000 },
};

const chartData: MonthlyChartData[] = [
  { month: 'May', orders: 5, profit: 25000, revenue: 75000 },
];

describe('DashboardClientPage', () => {
  it('labels paid 30-day dashboard metrics as period-scoped values', async () => {
    render(
      <DashboardClientPage
        initialChartData={chartData}
        initialMetrics={metrics}
        initialRecentSales={[]}
      />
    );

    expect(await screen.findByText('30-Day Paid Revenue')).toBeInTheDocument();
    expect(screen.getByText('30-Day Paid Orders')).toBeInTheDocument();
    expect(screen.getByText('30-Day Customers')).toBeInTheDocument();
    expect(screen.getByTitle('30-Day Paid Orders')).toHaveTextContent(
      '30D Paid'
    );
    expect(screen.getByTitle('30-Day Customers')).toHaveTextContent('30D New');
    expect(screen.queryByText('Total Revenue')).not.toBeInTheDocument();
    expect(screen.queryByText('Active Orders')).not.toBeInTheDocument();
    expect(screen.queryByText('New')).not.toBeInTheDocument();
  });
});
