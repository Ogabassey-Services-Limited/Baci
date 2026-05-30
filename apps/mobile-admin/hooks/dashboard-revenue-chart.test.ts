import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchRevenueChart } from './dashboard-revenue-chart';

type QueryCall = { method: string; args: unknown[] };
type RevenueOrder = { created_at: string; total: number | null };
type RevenueQueryResult = {
  data: RevenueOrder[] | null;
  error: { message: string } | null;
};
type RevenueQuery = Promise<RevenueQueryResult> & {
  eq: (...args: unknown[]) => RevenueQuery;
  gte: (...args: unknown[]) => RevenueQuery;
  lte: (...args: unknown[]) => RevenueQuery;
  select: (...args: unknown[]) => RevenueQuery;
};

const mocks = vi.hoisted(() => ({
  calls: [] as QueryCall[],
  error: null as { message: string } | null,
  orders: [] as RevenueOrder[],
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const query = Promise.resolve().then(() => ({
        data: mocks.orders,
        error: mocks.error,
      })) as RevenueQuery;
      query.eq = (...args: unknown[]) => {
        mocks.calls.push({ args, method: `${table}.eq` });
        return query;
      };
      query.gte = (...args: unknown[]) => {
        mocks.calls.push({ args, method: `${table}.gte` });
        return query;
      };
      query.lte = (...args: unknown[]) => {
        mocks.calls.push({ args, method: `${table}.lte` });
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

describe('fetchRevenueChart', () => {
  beforeEach(() => {
    mocks.calls = [];
    mocks.error = null;
    mocks.orders = [];
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 30, 20));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('buckets today revenue and applies branch scope', async () => {
    mocks.orders = [
      { created_at: new Date(2026, 4, 30, 9).toISOString(), total: 1200 },
      { created_at: new Date(2026, 4, 30, 17).toISOString(), total: 300 },
      { created_at: new Date(2026, 4, 30, 17, 30).toISOString(), total: null },
    ];

    const chart = await fetchRevenueChart('merchant-1', 'today', {
      branchId: 'branch-1',
      type: 'branch',
    });

    expect(chart).toEqual([
      { label: '12am', value: 0 },
      { label: '4am', value: 0 },
      { label: '8am', value: 1200 },
      { label: '12pm', value: 0 },
      { label: '4pm', value: 300 },
      { label: '8pm', value: 0 },
    ]);
    expect(mocks.calls).toContainEqual({
      args: ['merchant_id', 'merchant-1'],
      method: 'orders.eq',
    });
    expect(mocks.calls).toContainEqual({
      args: ['branch_id', 'branch-1'],
      method: 'orders.eq',
    });
  });

  it('throws a descriptive error when the orders query fails', async () => {
    mocks.error = { message: 'connection failed' };

    await expect(fetchRevenueChart('merchant-1', 'week')).rejects.toThrow(
      'fetchRevenueChart orders query failed: connection failed'
    );
  });
});
