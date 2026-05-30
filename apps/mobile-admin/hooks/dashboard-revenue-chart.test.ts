import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildRevenueChartBuckets,
  fetchRevenueChart,
} from './dashboard-revenue-chart';

type RpcCall = { name: string; args: Record<string, unknown> };

const mocks = vi.hoisted(() => ({
  calls: [] as RpcCall[],
  data: [] as Array<{ label: string; value: number }>,
  error: null as { message: string } | null,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (name: string, args: Record<string, unknown>) => {
      mocks.calls.push({ args, name });
      return Promise.resolve({ data: mocks.data, error: mocks.error });
    },
  },
}));

describe('fetchRevenueChart', () => {
  beforeEach(() => {
    mocks.calls = [];
    mocks.data = [];
    mocks.error = null;
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 30, 20));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads chart values through the aggregate RPC with branch scope', async () => {
    mocks.data = [
      { label: '12am', value: 0 },
      { label: '4am', value: 0 },
      { label: '8am', value: 1200 },
      { label: '12pm', value: 0 },
      { label: '4pm', value: 300 },
      { label: '8pm', value: 0 },
    ];

    const chart = await fetchRevenueChart('merchant-1', 'today', {
      branchId: 'branch-1',
      type: 'branch',
    });

    expect(chart).toEqual(mocks.data);
    expect(mocks.calls).toEqual([
      {
        args: expect.objectContaining({
          p_branch_id: 'branch-1',
          p_merchant_id: 'merchant-1',
          p_buckets: expect.arrayContaining([
            expect.objectContaining({
              label: '8am',
              ordinal: 2,
            }),
          ]),
        }),
        name: 'get_mobile_admin_revenue_chart',
      },
    ]);
  });

  it('builds non-overlapping month buckets', () => {
    const buckets = buildRevenueChartBuckets('month');

    expect(buckets[0]).toEqual(
      expect.objectContaining({
        label: 'Wk 1',
        start_at: new Date(2026, 4, 1).toISOString(),
      })
    );
    for (let index = 1; index < buckets.length; index += 1) {
      expect(new Date(buckets[index - 1].end_at).getTime()).toBeLessThanOrEqual(
        new Date(buckets[index].start_at).getTime()
      );
    }
  });

  it('throws a descriptive error when the chart RPC fails', async () => {
    mocks.error = { message: 'connection failed' };

    await expect(fetchRevenueChart('merchant-1', 'week')).rejects.toThrow(
      'fetchRevenueChart rpc failed: connection failed'
    );
  });
});
