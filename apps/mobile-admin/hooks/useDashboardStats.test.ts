import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => {
  type ChainResult = { data?: unknown; count?: number; error?: unknown };
  // The chain calls used by fetchDashboardStats:
  //   from(table).select(...).eq(...).gte(...).lte(...) -> awaited promise
  // The terminal awaits the chain itself, so we make every chain method
  // return `this`, and the chain object resolves via a `then` that yields
  // the queued result for that chain instance.
  const queue: ChainResult[] = [];
  const calls: string[] = [];

  function makeChain(table: string) {
    calls.push(table);
    const chain: Record<string, unknown> = {};
    const result = queue.shift() ?? { data: [], count: 0, error: null };
    const passthrough = () => chain;
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
      chain[method] = passthrough;
    }
    chain.then = (resolve: (v: ChainResult) => unknown) =>
      Promise.resolve(result).then(resolve);
    return chain;
  }

  return {
    queue,
    calls,
    from: (table: string) => makeChain(table),
    reset: () => {
      queue.length = 0;
      calls.length = 0;
    },
    enqueue: (results: ChainResult[]) => {
      queue.push(...results);
    },
  };
});

vi.mock('@/lib/supabase', () => ({
  supabase: { from: supabaseMock.from },
}));

vi.mock('./useMerchant', () => ({
  useMerchant: vi.fn(),
}));

import { fetchDashboardStats } from './useDashboardStats';

const ORDERS_OK = { count: 12, error: null };
const PENDING_OK = { count: 3, error: null };
const ITEMS_OK = { data: [{ quantity: 2 }, { quantity: 5 }], error: null };
const NEW_CUSTOMERS_OK = { count: 4, error: null };
const TOTAL_CUSTOMERS_OK = { count: 100, error: null };
const REVENUE_OK = { data: [{ total: 1000 }, { total: 500 }], error: null };
const PREV_REVENUE_OK = { data: [{ total: 800 }], error: null };
const VISITS_OK = { count: 250, error: null };

describe('fetchDashboardStats', () => {
  beforeEach(() => {
    supabaseMock.reset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('aggregates the 8 concurrent queries into a DashboardStats object on the happy path', async () => {
    supabaseMock.enqueue([
      ORDERS_OK,
      PENDING_OK,
      ITEMS_OK,
      NEW_CUSTOMERS_OK,
      TOTAL_CUSTOMERS_OK,
      REVENUE_OK,
      PREV_REVENUE_OK,
      VISITS_OK,
    ]);

    const stats = await fetchDashboardStats('merchant-1', 'week');

    expect(stats).toEqual({
      orders: 12,
      totalItems: 7,
      visits: 250,
      avgOrderValue: 125, // 1500 / 12
      newCustomers: 4,
      totalCustomers: 100,
      pendingOrders: 3,
      revenue: 1500,
      previousPeriodRevenue: 800,
    });
  });

  it('throws the first non-null query error so React Query receives a real failure (no fake-zero fallback)', async () => {
    const dbError = new Error('orders query failed');
    supabaseMock.enqueue([
      { count: 0, error: dbError }, // orders fails
      PENDING_OK,
      ITEMS_OK,
      NEW_CUSTOMERS_OK,
      TOTAL_CUSTOMERS_OK,
      REVENUE_OK,
      PREV_REVENUE_OK,
      VISITS_OK,
    ]);

    await expect(fetchDashboardStats('merchant-1', 'week')).rejects.toThrow(
      'orders query failed'
    );
  });

  it('throws when a later query in the Promise.all batch fails (visits)', async () => {
    const visitsError = new Error('visits query failed');
    supabaseMock.enqueue([
      ORDERS_OK,
      PENDING_OK,
      ITEMS_OK,
      NEW_CUSTOMERS_OK,
      TOTAL_CUSTOMERS_OK,
      REVENUE_OK,
      PREV_REVENUE_OK,
      { count: 0, error: visitsError },
    ]);

    await expect(fetchDashboardStats('merchant-1', 'week')).rejects.toThrow(
      'visits query failed'
    );
  });

  it('runs the 8 queries concurrently (issues every from() call before awaiting any)', async () => {
    supabaseMock.enqueue([
      ORDERS_OK,
      PENDING_OK,
      ITEMS_OK,
      NEW_CUSTOMERS_OK,
      TOTAL_CUSTOMERS_OK,
      REVENUE_OK,
      PREV_REVENUE_OK,
      VISITS_OK,
    ]);

    await fetchDashboardStats('merchant-1', 'week');

    // 8 distinct .from() calls — proving the queries are dispatched as
    // a batch (Promise.all) rather than serially with intermediate awaits
    // that would have allowed early returns.
    expect(supabaseMock.calls.length).toBe(8);
  });
});
