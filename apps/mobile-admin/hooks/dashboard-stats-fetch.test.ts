import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchDashboardStats } from './dashboard-stats-fetch';

type RpcCall = { name: string; args: Record<string, unknown> };
type RpcResult = {
  data: Record<string, unknown> | null;
  error: Error | null;
};

const mocks = vi.hoisted(() => ({
  calls: [] as RpcCall[],
  result: {
    data: null,
    error: null,
  } as RpcResult,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (name: string, args: Record<string, unknown>) => {
      mocks.calls.push({ args, name });
      return Promise.resolve(mocks.result);
    },
  },
}));

describe('fetchDashboardStats', () => {
  beforeEach(() => {
    mocks.calls = [];
    mocks.result = { data: null, error: null };
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 30, 20));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads dashboard stats through the aggregate RPC with branch scope', async () => {
    mocks.result = {
      data: {
        avgOrderValue: 500,
        newCustomers: 2,
        orders: 4,
        pendingOrders: 1,
        previousPeriodRevenue: 500,
        revenue: 2000,
        totalCustomers: 9,
        totalItems: 3,
        visits: 6,
      },
      error: null,
    };

    const stats = await fetchDashboardStats('merchant-1', 'today', {
      branchId: 'branch-1',
      type: 'branch',
    });

    expect(stats).toEqual({
      avgOrderValue: 500,
      newCustomers: 2,
      orders: 4,
      pendingOrders: 1,
      previousPeriodRevenue: 500,
      revenue: 2000,
      totalCustomers: 9,
      totalItems: 3,
      visits: 6,
    });
    expect(mocks.calls).toEqual([
      {
        args: expect.objectContaining({
          p_branch_id: 'branch-1',
          p_merchant_id: 'merchant-1',
          p_previous_end_at: new Date(2026, 4, 30).toISOString(),
          p_previous_start_at: new Date(2026, 4, 29).toISOString(),
          p_start_at: new Date(2026, 4, 30).toISOString(),
        }),
        name: 'get_mobile_admin_dashboard_stats',
      },
    ]);
  });

  it('throws the RPC error', async () => {
    const error = new Error('stats unavailable');
    mocks.result = { data: null, error };

    await expect(fetchDashboardStats('merchant-1', 'today')).rejects.toBe(
      error
    );
  });
});
