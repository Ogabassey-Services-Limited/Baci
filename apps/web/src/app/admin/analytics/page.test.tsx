import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const toastApi = { toast: vi.fn() };

function MockChart({ children }: { children?: ReactNode }) {
  return <div>{children}</div>;
}

vi.mock('recharts', () => ({
  Area: MockChart,
  AreaChart: MockChart,
  Bar: MockChart,
  BarChart: MockChart,
  CartesianGrid: MockChart,
  ResponsiveContainer: MockChart,
  Tooltip: MockChart,
  XAxis: MockChart,
  YAxis: MockChart,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => toastApi,
}));

import AnalyticsPage from '@/app/admin/analytics/page';

const analyticsResponse = {
  businessTypes: [],
  dailyGmv: [
    {
      date: '2026-03-20',
      gmv: 1200,
      merchants: 3,
      orders: 2,
    },
  ],
  generatedAt: '2026-03-20T10:00:00.000Z',
  growth: {
    gmvGrowthRate: 50,
    merchantGrowthRate: 25,
    newMerchantsThisMonth: 4,
  },
  merchantActivation: [],
  merchantHealth: {
    atRisk: 0,
    churned: 0,
    healthy: 2,
    new: 1,
  },
  paymentMethods: [
    {
      amount: 700,
      label: 'Card',
      method: 'card',
      orders: 1,
      shareOfPaidAmount: 100,
      shareOfPaidOrders: 100,
    },
  ],
  paymentStatuses: [
    {
      amount: 700,
      label: 'Paid',
      orders: 1,
      shareOfAmount: 70,
      shareOfOrders: 50,
      status: 'paid',
    },
    {
      amount: 300,
      label: 'Pending',
      orders: 1,
      shareOfAmount: 30,
      shareOfOrders: 50,
      status: 'pending',
    },
  ],
  salesByChannel: [],
  shippingStatuses: [
    {
      amount: 700,
      label: 'Processing',
      orders: 1,
      shareOfAmount: 70,
      shareOfOrders: 50,
      status: 'processing',
    },
  ],
  signupSources: [],
  summary: {
    activeMerchants: 12,
    aovChange: -10,
    avgGmvPerMerchant: 100,
    avgOrderValue: 700,
    grossGmv: 1000,
    grossOrders: 2,
    gmvChange: 50,
    netToMerchants: 90,
    orderChange: 25,
    platformRevenue: 10,
    processorFees: 2,
    totalGmv: 700,
    totalMerchants: 20,
    totalOrders: 1,
  },
  topMerchants: [
    {
      gmv: 700,
      id: 'merchant-1',
      name: 'Baci Store',
      orders: 1,
    },
  ],
};

describe('AnalyticsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => analyticsResponse,
        ok: true,
      }) as unknown as typeof fetch
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders real analytics payload data and order pipeline breakdowns', async () => {
    render(<AnalyticsPage />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/analytics?period=30d'
      );
    });

    expect(await screen.findByText('Active Merchants')).toBeInTheDocument();
    expect(await screen.findByText('12')).toBeInTheDocument();
    expect(await screen.findByText('Payment Pipeline')).toBeInTheDocument();
    expect(await screen.findByText('Paid')).toBeInTheDocument();
    expect(await screen.findByText('Fulfillment Pipeline')).toBeInTheDocument();
    expect(await screen.findByText('Processing')).toBeInTheDocument();
    expect(await screen.findByText('Paid Order Methods')).toBeInTheDocument();
    expect(await screen.findByText('Card')).toBeInTheDocument();
  });
});
