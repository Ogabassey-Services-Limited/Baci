import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchDashboardStats } from './dashboard-stats-fetch';

type QueryCall = { method: string; args: unknown[] };
type QueryResult = {
  count?: number | null;
  data?: Array<{ quantity?: number | null; total?: number | null }> | null;
  error?: unknown;
};
type StatsQuery = Promise<QueryResult> & {
  eq: (...args: unknown[]) => StatsQuery;
  gte: (...args: unknown[]) => StatsQuery;
  lt: (...args: unknown[]) => StatsQuery;
  select: (...args: unknown[]) => StatsQuery;
};

const mocks = vi.hoisted(() => ({
  calls: [] as QueryCall[],
  results: [] as QueryResult[],
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const query = Promise.resolve().then(
        () => mocks.results.shift() ?? { data: null, error: null }
      ) as StatsQuery;
      query.eq = (...args: unknown[]) => {
        mocks.calls.push({ args, method: `${table}.eq` });
        return query;
      };
      query.gte = (...args: unknown[]) => {
        mocks.calls.push({ args, method: `${table}.gte` });
        return query;
      };
      query.lt = (...args: unknown[]) => {
        mocks.calls.push({ args, method: `${table}.lt` });
        return query;
      };
      query.select = (...args: unknown[]) => {
        mocks.calls.push({ args, method: `${table}.select` });
        return query;
      };
      return query;
    },
  },
}));

describe('fetchDashboardStats', () => {
  beforeEach(() => {
    mocks.calls = [];
    mocks.results = [];
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('combines dashboard query results and scopes branch order queries', async () => {
    mocks.results = [
      { count: 4, error: null },
      { count: 1, error: null },
      { data: [{ quantity: 2 }, { quantity: null }], error: null },
      { count: 2, error: null },
      { count: 9, error: null },
      { data: [{ total: 1200 }, { total: null }, { total: 800 }], error: null },
      { data: [{ total: 500 }], error: null },
      { count: 6, error: null },
    ];

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
    expect(mocks.calls).toContainEqual({
      args: ['branch_id', 'branch-1'],
      method: 'orders.eq',
    });
    expect(mocks.calls).toContainEqual({
      args: ['orders.branch_id', 'branch-1'],
      method: 'order_items.eq',
    });
  });

  it('throws the first query error', async () => {
    const error = new Error('orders unavailable');
    mocks.results = [
      { count: null, error },
      { count: 0, error: null },
      { data: [], error: null },
      { count: 0, error: null },
      { count: 0, error: null },
      { data: [], error: null },
      { data: [], error: null },
      { count: 0, error: null },
    ];

    await expect(fetchDashboardStats('merchant-1', 'today')).rejects.toBe(
      error
    );
  });
});
