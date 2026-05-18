import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createClient = vi.fn();
const getMerchantForUser = vi.fn();
const getDashboardMetrics = vi.fn();
const getRecentSales = vi.fn();
const getMonthlyChartData = vi.fn();
const getCachedOpenAIFeedData = vi.fn();
const getCachedGoogleMerchantFeedData = vi.fn();
const loadAgenticActionHealth = vi.fn();
const buildMerchantTrustProfile = vi.fn();
const buildAgentCommerceTrustReadiness = vi.fn();

const clientProps = vi.fn();

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({})),
}));

vi.mock('@/lib/merchant-server', () => ({
  getMerchantForUser: () => getMerchantForUser(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => createClient(...args),
}));

vi.mock('@/lib/agentic/action-health-loader', () => ({
  loadAgenticActionHealth: (...args: unknown[]) =>
    loadAgenticActionHealth(...args),
}));

vi.mock('@/lib/store-url', () => ({
  buildStoreUrl: () => 'https://shop.example.com',
}));

vi.mock('@/lib/storefront-trust/build-merchant-trust-profile', () => ({
  buildMerchantTrustProfile: (...args: unknown[]) =>
    buildMerchantTrustProfile(...args),
}));

vi.mock(
  '@/lib/storefront-trust/build-agent-commerce-trust-readiness',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('@/lib/storefront-trust/build-agent-commerce-trust-readiness')
      >();
    return {
      ...actual,
      buildAgentCommerceTrustReadiness: (...args: unknown[]) =>
        buildAgentCommerceTrustReadiness(...args),
    };
  }
);

vi.mock('./actions', () => ({
  getDashboardMetrics: (...args: unknown[]) => getDashboardMetrics(...args),
  getRecentSales: (...args: unknown[]) => getRecentSales(...args),
  getMonthlyChartData: (...args: unknown[]) => getMonthlyChartData(...args),
}));

vi.mock('../api/feed/openai/feed-data', () => ({
  getCachedOpenAIFeedData: (...args: unknown[]) =>
    getCachedOpenAIFeedData(...args),
}));

vi.mock('../api/feed/google-merchant/feed-data', () => ({
  getCachedGoogleMerchantFeedData: (...args: unknown[]) =>
    getCachedGoogleMerchantFeedData(...args),
}));

vi.mock('./client-page', () => ({
  default: (props: Record<string, unknown>) => {
    clientProps(props);
    return <div data-testid="client-page" />;
  },
}));

const merchantBase = {
  business_name: 'Demo Store',
  custom_domain: null,
  id: 'merchant-1',
  slug: 'demo',
};

async function renderDashboardData() {
  const { DashboardData } = await import('./dashboard-data');
  const ui = await DashboardData();
  render(ui);
}

describe('DashboardData', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    createClient.mockReturnValue({});
    loadAgenticActionHealth.mockResolvedValue({
      actions: [
        {
          code: 'AGENTIC_ACTIONS_HEALTHY',
          count: 0,
          message: 'No recent agentic action issues need attention.',
          severity: 'ok',
        },
      ],
      generated_at: '2026-05-16T12:00:00.000Z',
    });
    getDashboardMetrics.mockResolvedValue(null);
    getRecentSales.mockResolvedValue([]);
    getMonthlyChartData.mockResolvedValue([]);
  });

  it('loads only home dashboard data for published merchants', async () => {
    getMerchantForUser.mockResolvedValue({
      merchant: { ...merchantBase, is_published: true },
    });
    getDashboardMetrics.mockResolvedValue({
      activeNow: { change: 0, value: 1 },
      aov: 0,
      customers: { change: 0, value: 2 },
      fulfillmentRate: 0,
      orders: { change: 0, value: 3 },
      revenue: { change: 0, value: 4 },
    });

    await renderDashboardData();

    expect(buildAgentCommerceTrustReadiness).not.toHaveBeenCalled();
    expect(loadAgenticActionHealth).not.toHaveBeenCalled();
    expect(getCachedOpenAIFeedData).not.toHaveBeenCalled();
    expect(getCachedGoogleMerchantFeedData).not.toHaveBeenCalled();
    const props = clientProps.mock.calls[0][0];
    expect(props.initialMetrics).toMatchObject({
      revenue: { value: 4 },
      orders: { value: 3 },
    });
    expect(props).not.toHaveProperty('initialActionHealth');
    expect(props).not.toHaveProperty('initialTrustReadiness');
  });

  it('does not load agentic centers for unpublished merchants', async () => {
    getMerchantForUser.mockResolvedValue({
      merchant: { ...merchantBase, is_published: false },
    });

    await renderDashboardData();

    expect(buildAgentCommerceTrustReadiness).not.toHaveBeenCalled();
    expect(getCachedOpenAIFeedData).not.toHaveBeenCalled();
    expect(getCachedGoogleMerchantFeedData).not.toHaveBeenCalled();
    expect(loadAgenticActionHealth).not.toHaveBeenCalled();

    const props = clientProps.mock.calls[0][0];
    expect(props).not.toHaveProperty('initialActionHealth');
    expect(props).not.toHaveProperty('initialTrustReadiness');
  });

  it('renders the client page when there is no merchant', async () => {
    getMerchantForUser.mockResolvedValue({ merchant: null });

    await renderDashboardData();

    expect(buildAgentCommerceTrustReadiness).not.toHaveBeenCalled();
    const props = clientProps.mock.calls[0][0];
    expect(props).toEqual({});
  });

  it('keeps recent sales and chart data when metrics loading rejects', async () => {
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const recentSales = [{ id: 'sale-1', total: 1000 }];
    const chartData = [{ month: 'May', revenue: 1000 }];
    getMerchantForUser.mockResolvedValue({
      merchant: { ...merchantBase, is_published: true },
    });
    getDashboardMetrics.mockRejectedValueOnce(new Error('metrics failed'));
    getRecentSales.mockResolvedValueOnce(recentSales);
    getMonthlyChartData.mockResolvedValueOnce(chartData);

    await renderDashboardData();

    const props = clientProps.mock.calls[0][0];
    expect(props.initialMetrics).toBeUndefined();
    expect(props.initialRecentSales).toBe(recentSales);
    expect(props.initialChartData).toBe(chartData);
    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to fetch dashboard metrics:',
      'metrics failed'
    );
  });

  it('falls back to empty recent sales when recent sales loading rejects', async () => {
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const metrics = {
      activeNow: { change: 0, value: 1 },
      aov: 0,
      customers: { change: 0, value: 2 },
      fulfillmentRate: 0,
      orders: { change: 0, value: 3 },
      revenue: { change: 0, value: 4 },
    };
    const chartData = [{ month: 'May', revenue: 1000 }];
    getMerchantForUser.mockResolvedValue({
      merchant: { ...merchantBase, is_published: true },
    });
    getDashboardMetrics.mockResolvedValueOnce(metrics);
    getRecentSales.mockRejectedValueOnce(new Error('sales failed'));
    getMonthlyChartData.mockResolvedValueOnce(chartData);

    await renderDashboardData();

    const props = clientProps.mock.calls[0][0];
    expect(props.initialMetrics).toBe(metrics);
    expect(props.initialRecentSales).toEqual([]);
    expect(props.initialChartData).toBe(chartData);
    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to fetch recent sales:',
      'sales failed'
    );
  });

  it('falls back to empty chart data when chart loading rejects', async () => {
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const metrics = {
      activeNow: { change: 0, value: 1 },
      aov: 0,
      customers: { change: 0, value: 2 },
      fulfillmentRate: 0,
      orders: { change: 0, value: 3 },
      revenue: { change: 0, value: 4 },
    };
    const recentSales = [{ id: 'sale-1', total: 1000 }];
    getMerchantForUser.mockResolvedValue({
      merchant: { ...merchantBase, is_published: true },
    });
    getDashboardMetrics.mockResolvedValueOnce(metrics);
    getRecentSales.mockResolvedValueOnce(recentSales);
    getMonthlyChartData.mockRejectedValueOnce(new Error('chart failed'));

    await renderDashboardData();

    const props = clientProps.mock.calls[0][0];
    expect(props.initialMetrics).toBe(metrics);
    expect(props.initialRecentSales).toBe(recentSales);
    expect(props.initialChartData).toEqual([]);
    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to fetch chart data:',
      'chart failed'
    );
  });
});
