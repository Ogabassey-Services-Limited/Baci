import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requestMerchantPublish } from '@/lib/merchant-publish-client';
import type { DashboardMetrics, MonthlyChartData } from './actions';
import DashboardClientPage from './client-page';

const { merchantState, mockReloadMerchant, mockRouterRefresh, mockToast } =
  vi.hoisted(() => ({
    merchantState: {
      merchant: {
        business_name: 'Demo Store',
        country: 'NG',
        id: 'merchant-1',
        is_published: true,
        slug: 'demo-store',
      },
    },
    mockReloadMerchant: vi.fn(),
    mockRouterRefresh: vi.fn(),
    mockToast: vi.fn(),
  }));

vi.mock('next/dynamic', () => ({
  default: () =>
    function DynamicChartStub() {
      return <div data-testid="dashboard-chart" />;
    },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRouterRefresh }),
}));

vi.mock('@/components/dashboard/setup-checklist', () => ({
  SetupChecklist: () => <div data-testid="setup-checklist" />,
}));

vi.mock('@/components/dashboard/store-build-status-card', () => ({
  StoreBuildStatusCard: () => <div data-testid="store-build-status-card" />,
}));

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchant: () => ({
    merchant: merchantState.merchant,
    reloadMerchant: mockReloadMerchant,
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
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

function renderDashboard() {
  return render(
    <DashboardClientPage
      initialChartData={chartData}
      initialMetrics={metrics}
      initialRecentSales={[]}
    />
  );
}

function switchMerchantToSecondStore() {
  merchantState.merchant = {
    business_name: 'Second Store',
    country: 'NG',
    id: 'merchant-2',
    is_published: false,
    slug: 'second-store',
  };
}

describe('DashboardClientPage publish state', () => {
  beforeEach(() => {
    merchantState.merchant = {
      business_name: 'Demo Store',
      country: 'NG',
      id: 'merchant-1',
      is_published: true,
      slug: 'demo-store',
    };
    vi.clearAllMocks();
  });

  it('unpublishes the active merchant ID from the dashboard action', async () => {
    vi.mocked(requestMerchantPublish).mockResolvedValue(new Response('{}'));

    renderDashboard();

    fireEvent.click(
      await screen.findByRole('button', { name: 'Unpublish Store' })
    );

    await waitFor(() => {
      expect(requestMerchantPublish).toHaveBeenCalledWith('merchant-1', true);
    });
  });

  it('does not apply a previous merchant publish completion after a switch', async () => {
    let resolveRequest: ((response: Response) => void) | undefined;
    vi.mocked(requestMerchantPublish).mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveRequest = resolve;
      })
    );

    const { rerender } = renderDashboard();

    fireEvent.click(
      await screen.findByRole('button', { name: 'Unpublish Store' })
    );
    switchMerchantToSecondStore();
    rerender(
      <DashboardClientPage
        initialChartData={chartData}
        initialMetrics={metrics}
        initialRecentSales={[]}
      />
    );

    expect(
      await screen.findByRole('button', { name: 'Publish Store' })
    ).toBeEnabled();

    await act(async () => {
      resolveRequest?.(new Response('{}'));
      await Promise.resolve();
    });

    expect(mockToast).not.toHaveBeenCalled();
    expect(mockReloadMerchant).not.toHaveBeenCalled();
    expect(mockRouterRefresh).not.toHaveBeenCalled();
  });

  it('does not show a previous merchant publish failure after a switch', async () => {
    let resolveRequest: ((response: Response) => void) | undefined;
    vi.mocked(requestMerchantPublish).mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveRequest = resolve;
      })
    );

    const { rerender } = renderDashboard();

    fireEvent.click(
      await screen.findByRole('button', { name: 'Unpublish Store' })
    );
    switchMerchantToSecondStore();
    rerender(
      <DashboardClientPage
        initialChartData={chartData}
        initialMetrics={metrics}
        initialRecentSales={[]}
      />
    );

    await act(async () => {
      resolveRequest?.(
        new Response(JSON.stringify({ error: 'Store is not ready' }), {
          status: 400,
        })
      );
      await Promise.resolve();
    });

    expect(mockToast).not.toHaveBeenCalled();
  });

  it('keeps both merchant actions pending when switching back during overlapping requests', async () => {
    const resolveRequests = new Map<string, (response: Response) => void>();
    vi.mocked(requestMerchantPublish).mockImplementation(
      (merchantId) =>
        new Promise<Response>((resolve) => {
          resolveRequests.set(merchantId, resolve);
        })
    );

    const { rerender } = renderDashboard();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Unpublish Store' })
    );

    switchMerchantToSecondStore();
    rerender(
      <DashboardClientPage
        initialChartData={chartData}
        initialMetrics={metrics}
        initialRecentSales={[]}
      />
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Publish Store' })
    );

    merchantState.merchant = {
      business_name: 'Demo Store',
      country: 'NG',
      id: 'merchant-1',
      is_published: true,
      slug: 'demo-store',
    };
    rerender(
      <DashboardClientPage
        initialChartData={chartData}
        initialMetrics={metrics}
        initialRecentSales={[]}
      />
    );

    expect(
      await screen.findByRole('button', { name: 'Updating...' })
    ).toBeDisabled();
  });
});
