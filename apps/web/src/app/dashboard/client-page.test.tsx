import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardMetrics, MonthlyChartData, RecentSale } from './actions';

const mocks = vi.hoisted(() => ({
  mockGetDashboardMetrics: vi.fn(),
  mockGetMonthlyChartData: vi.fn(),
  mockGetRecentSales: vi.fn(),
  mockReloadMerchant: vi.fn(),
  mockToast: vi.fn(),
  mockUseMerchant: vi.fn(),
}));

vi.mock('./actions', () => ({
  getDashboardMetrics: mocks.mockGetDashboardMetrics,
  getMonthlyChartData: mocks.mockGetMonthlyChartData,
  getRecentSales: mocks.mockGetRecentSales,
}));

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchant: mocks.mockUseMerchant,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mocks.mockToast }),
}));

vi.mock('@/components/dashboard/setup-checklist', () => ({
  SetupChecklist: () => <div>Checklist</div>,
}));

vi.mock('@/components/dashboard/store-build-status-card', () => ({
  StoreBuildStatusCard: () => <div>BuildStatus</div>,
}));

vi.mock('next/dynamic', () => ({
  default: () =>
    function MockChart() {
      return <div>Chart</div>;
    },
}));

import DashboardClientPage from './client-page';

const successfulMetrics: DashboardMetrics = {
  revenue: { value: 125_000, change: 18 },
  customers: { value: 42, change: 8 },
  orders: { value: 12, change: 4 },
  activeNow: { value: 7, change: 1 },
  fulfillmentRate: 91,
  aov: 10_416,
};

const successfulChartData: MonthlyChartData[] = [
  { month: 'Jan', revenue: 45_000, profit: 18_000, orders: 4 },
  { month: 'Feb', revenue: 80_000, profit: 35_000, orders: 8 },
];

const successfulRecentSales: RecentSale[] = [
  {
    id: 'sale-1',
    name: 'Ada Buyer',
    email: 'ada@example.com',
    amount: 35_000,
    status: 'Completed',
  },
];

function arrangeMerchant(overrides: Record<string, unknown> = {}) {
  mocks.mockUseMerchant.mockReturnValue({
    basePath: '/test-store',
    hasPermission: vi.fn(() => true),
    loading: false,
    merchant: {
      business_name: 'Test Store',
      country: 'NG',
      id: 'merchant-1',
      is_published: true,
      slug: 'test-store',
    },
    navigationCategories: [],
    reloadMerchant: mocks.mockReloadMerchant,
    routingMode: 'path',
    staffAccess: { isOwner: true, isStaff: false, permissions: {}, role: null },
    updateMerchant: vi.fn(),
    ...overrides,
  });
}

describe('DashboardClientPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    arrangeMerchant();
    mocks.mockGetDashboardMetrics.mockResolvedValue(successfulMetrics);
    mocks.mockGetMonthlyChartData.mockResolvedValue(successfulChartData);
    mocks.mockGetRecentSales.mockResolvedValue(successfulRecentSales);
  });

  it('renders dashboard metrics and subcomponents when data loads', async () => {
    render(<DashboardClientPage />);

    expect(
      await screen.findByRole('heading', { name: 'Dashboard' })
    ).toBeInTheDocument();
    expect(screen.getByText('Total Revenue')).toBeInTheDocument();
    expect(screen.getByText('Active Orders')).toBeInTheDocument();
    expect(screen.getAllByText('Customers').length).toBeGreaterThan(0);
    expect(screen.getByText('Avg. Order Value')).toBeInTheDocument();
    expect(screen.getByText('Ada Buyer')).toBeInTheDocument();
    expect(screen.getByText('Checklist')).toBeInTheDocument();
    expect(screen.getByText('BuildStatus')).toBeInTheDocument();
    expect(screen.getAllByText('Chart')).toHaveLength(2);
    expect(mocks.mockGetDashboardMetrics).toHaveBeenCalledWith('merchant-1');
    expect(mocks.mockGetRecentSales).toHaveBeenCalledWith('merchant-1', 5);
    expect(mocks.mockGetMonthlyChartData).toHaveBeenCalledWith('merchant-1');
  });

  it('shows merchant loading state before dashboard content', async () => {
    arrangeMerchant({ loading: true, merchant: null });

    render(<DashboardClientPage />);

    expect(
      await screen.findByRole('status', { name: 'Loading dashboard' })
    ).toBeInTheDocument();
    expect(mocks.mockGetDashboardMetrics).not.toHaveBeenCalled();
  });

  it('shows a missing-merchant message when the merchant context is empty', async () => {
    arrangeMerchant({ loading: false, merchant: null });

    render(<DashboardClientPage />);

    expect(
      await screen.findByRole('heading', { name: 'No merchant found' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('We could not find a store for this account.')
    ).toBeInTheDocument();
    expect(mocks.mockGetDashboardMetrics).not.toHaveBeenCalled();
  });

  it('shows dashboard loading state while metrics are pending', async () => {
    mocks.mockGetDashboardMetrics.mockImplementation(
      () => new Promise<DashboardMetrics>(() => undefined)
    );

    render(<DashboardClientPage />);

    expect(
      await screen.findByRole('status', { name: 'Loading dashboard' })
    ).toBeInTheDocument();
  });

  it('renders empty dashboard state when actions return no data', async () => {
    mocks.mockGetDashboardMetrics.mockResolvedValue(null);
    mocks.mockGetMonthlyChartData.mockResolvedValue([]);
    mocks.mockGetRecentSales.mockResolvedValue([]);

    render(<DashboardClientPage />);

    expect(
      await screen.findByRole('heading', { name: 'Dashboard' })
    ).toBeInTheDocument();
    expect(screen.getByText('No recent sales yet.')).toBeInTheDocument();
    expect(screen.getAllByText('0% from last month')).toHaveLength(3);
  });

  it('shows an error and destructive toast when metrics fail to load', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mocks.mockGetDashboardMetrics.mockRejectedValue(
      new Error('metrics failed')
    );

    render(<DashboardClientPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load dashboard data.'
    );
    await waitFor(() => {
      expect(mocks.mockToast).toHaveBeenCalledWith({
        title: 'Unable to load dashboard data',
        description: 'Refresh the page or try again shortly.',
        variant: 'destructive',
      });
    });
    consoleError.mockRestore();
  });

  it('shows an error and destructive toast when recent sales fail to load', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mocks.mockGetRecentSales.mockRejectedValue(new Error('sales failed'));

    render(<DashboardClientPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load dashboard data.'
    );
    await waitFor(() => {
      expect(mocks.mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive' })
      );
    });
    consoleError.mockRestore();
  });

  it('shows an error and destructive toast when chart data fails to load', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mocks.mockGetMonthlyChartData.mockRejectedValue(new Error('chart failed'));

    render(<DashboardClientPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load dashboard data.'
    );
    await waitFor(() => {
      expect(mocks.mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive' })
      );
    });
    consoleError.mockRestore();
  });

  it('unpublishes the store and refreshes merchant context when the status action succeeds', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<DashboardClientPage />);

    await user.click(
      await screen.findByRole('button', { name: /unpublish store/i })
    );

    expect(fetchMock).toHaveBeenCalledWith('/api/merchant/publish', {
      method: 'DELETE',
    });
    await waitFor(() => {
      expect(mocks.mockReloadMerchant).toHaveBeenCalled();
    });
    expect(mocks.mockToast).toHaveBeenCalledWith({
      title: 'Store Unpublished',
      description: 'Your store is now offline.',
    });
  });
});
