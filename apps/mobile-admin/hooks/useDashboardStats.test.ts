import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => {
  type ChainResult = { data?: unknown; count?: number; error?: unknown };
  type ChainCall = { method: string; args: unknown[] };
  type ChainRecord = { table: string; calls: ChainCall[] };
  // The chain calls used by fetchTopProducts:
  //   from(table).select(...).eq(...).gte(...).lte(...) -> awaited promise
  // The terminal awaits the chain itself, so every chain method returns the
  // same promise-like chain object seeded with the queued result.
  const queue: ChainResult[] = [];
  const rpcQueue: ChainResult[] = [];
  const rpcCalls: { name: string; args: Record<string, unknown> }[] = [];
  const calls: string[] = [];
  const chains: ChainRecord[] = [];

  function makeChain(table: string) {
    calls.push(table);
    const record: ChainRecord = { table, calls: [] };
    chains.push(record);
    const result = queue.shift() ?? { data: [], count: 0, error: null };
    const chain = Promise.resolve(result) as unknown as Record<string, unknown>;
    const passthrough =
      (method: string) =>
      (...args: unknown[]) => {
        record.calls.push({ method, args });
        return chain;
      };
    for (const method of [
      'select',
      'eq',
      'gte',
      'gt',
      'lte',
      'lt',
      'in',
      'order',
      'is',
      'not',
      'limit',
    ]) {
      chain[method] = passthrough(method);
    }
    return chain;
  }

  return {
    queue,
    calls,
    chains,
    rpcCalls,
    from: (table: string) => makeChain(table),
    rpc: (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      return Promise.resolve(rpcQueue.shift() ?? { data: [], error: null });
    },
    reset: () => {
      queue.length = 0;
      rpcQueue.length = 0;
      rpcCalls.length = 0;
      calls.length = 0;
      chains.length = 0;
    },
    enqueue: (results: ChainResult[]) => {
      queue.push(...results);
    },
    enqueueRpc: (results: ChainResult[]) => {
      rpcQueue.push(...results);
    },
  };
});

vi.mock('@/lib/supabase', () => ({
  supabase: { from: supabaseMock.from, rpc: supabaseMock.rpc },
}));

vi.mock('./useMerchant', () => ({
  useMerchant: vi.fn(),
}));

vi.mock('./useBranchScope', () => ({
  useBranchScope: () => ({ scope: { type: 'all' } }),
}));

import { fetchDashboardStats, fetchTopProducts } from './useDashboardStats';

describe('fetchDashboardStats', () => {
  beforeEach(() => {
    supabaseMock.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads dashboard stats through the aggregate RPC on the happy path', async () => {
    supabaseMock.enqueueRpc([
      {
        data: {
          avgOrderValue: 125,
          newCustomers: 4,
          orders: 12,
          pendingOrders: 3,
          previousPeriodRevenue: 800,
          revenue: 1500,
          totalCustomers: 100,
          totalItems: 7,
          visits: 250,
        },
        error: null,
      },
    ]);

    const stats = await fetchDashboardStats('merchant-1', 'week');

    expect(stats).toEqual({
      avgOrderValue: 125,
      newCustomers: 4,
      orders: 12,
      pendingOrders: 3,
      previousPeriodRevenue: 800,
      revenue: 1500,
      totalCustomers: 100,
      totalItems: 7,
      visits: 250,
    });
    expect(supabaseMock.rpcCalls).toEqual([
      {
        args: expect.objectContaining({
          p_branch_id: null,
          p_merchant_id: 'merchant-1',
          p_previous_end_at: expect.any(String),
          p_previous_start_at: expect.any(String),
          p_start_at: expect.any(String),
        }),
        name: 'get_mobile_admin_dashboard_stats',
      },
    ]);
    expect(supabaseMock.calls).toEqual([]);
  });

  it('throws the RPC error so React Query receives a real failure', async () => {
    const dbError = new Error('dashboard stats unavailable');
    supabaseMock.enqueueRpc([{ data: null, error: dbError }]);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(fetchDashboardStats('merchant-1', 'week')).rejects.toThrow(
      'dashboard stats unavailable'
    );
  });

  it('passes the selected branch to the aggregate RPC', async () => {
    supabaseMock.enqueueRpc([
      {
        data: {
          orders: 1,
        },
        error: null,
      },
    ]);

    await fetchDashboardStats('merchant-1', 'week', {
      branchId: 'branch-1',
      type: 'branch',
    });

    expect(supabaseMock.rpcCalls).toEqual([
      {
        args: expect.objectContaining({
          p_branch_id: 'branch-1',
          p_merchant_id: 'merchant-1',
        }),
        name: 'get_mobile_admin_dashboard_stats',
      },
    ]);
  });

  it('passes null branch scope and null date bounds for all-location all-time stats', async () => {
    supabaseMock.enqueueRpc([
      {
        data: {
          orders: 1,
        },
        error: null,
      },
    ]);

    await fetchDashboardStats('merchant-1', 'all', { type: 'all' });

    expect(supabaseMock.rpcCalls).toEqual([
      {
        args: {
          p_branch_id: null,
          p_merchant_id: 'merchant-1',
          p_previous_end_at: null,
          p_previous_start_at: null,
          p_start_at: null,
        },
        name: 'get_mobile_admin_dashboard_stats',
      },
    ]);
  });

  it('defaults missing RPC fields to zero', async () => {
    supabaseMock.enqueueRpc([{ data: {}, error: null }]);

    await expect(fetchDashboardStats('merchant-1', 'week')).resolves.toEqual({
      avgOrderValue: 0,
      newCustomers: 0,
      orders: 0,
      pendingOrders: 0,
      previousPeriodRevenue: 0,
      revenue: 0,
      totalCustomers: 0,
      totalItems: 0,
      visits: 0,
    });
  });
});

describe('fetchTopProducts', () => {
  beforeEach(() => {
    supabaseMock.reset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('uses the all-location RPC path for all branch scope', async () => {
    supabaseMock.enqueueRpc([
      {
        data: [
          {
            id: 'product-1',
            name: 'Phone',
            price: 100,
            image_url: 'phone.jpg',
            total_sold: 3,
            total_revenue: 300,
          },
        ],
        error: null,
      },
    ]);

    const products = await fetchTopProducts('merchant-1', 5, { type: 'all' });

    expect(supabaseMock.rpcCalls).toEqual([
      {
        name: 'get_top_products',
        args: expect.objectContaining({
          p_branch_id: null,
          p_merchant_id: 'merchant-1',
          p_limit: 5,
        }),
      },
    ]);
    expect(products).toEqual([
      {
        id: 'product-1',
        name: 'Phone',
        price: 100,
        imageUrl: 'phone.jpg',
        totalSold: 3,
        totalRevenue: 300,
      },
    ]);
  });

  it('passes selected branch scope to the top products RPC', async () => {
    supabaseMock.enqueueRpc([
      {
        data: [
          {
            id: 'product-1',
            image_url: 'phone.jpg',
            name: 'Phone',
            price: 200,
            total_revenue: 300,
            total_sold: 2,
          },
        ],
        error: null,
      },
    ]);

    const products = await fetchTopProducts('merchant-1', 5, {
      type: 'branch',
      branchId: 'branch-1',
    });

    expect(supabaseMock.calls).toEqual([]);
    expect(supabaseMock.rpcCalls).toEqual([
      {
        name: 'get_top_products',
        args: expect.objectContaining({
          p_branch_id: 'branch-1',
          p_merchant_id: 'merchant-1',
          p_limit: 5,
        }),
      },
    ]);
    expect(products).toEqual([
      {
        id: 'product-1',
        name: 'Phone',
        price: 200,
        imageUrl: 'phone.jpg',
        totalSold: 2,
        totalRevenue: 300,
      },
    ]);
  });
});
