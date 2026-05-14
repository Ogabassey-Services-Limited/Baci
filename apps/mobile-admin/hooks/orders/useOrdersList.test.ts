import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => {
  type QueryResult = {
    count: number;
    data: Array<{ id: string; order_items: Array<{ id: string }> }>;
    error: { message: string } | null;
  };
  const chainCalls: Array<{ args: unknown[]; method: string }> = [];
  let result: QueryResult = {
    count: 1,
    data: [{ id: 'order-1', order_items: [{ id: 'item-1' }] }],
    error: null,
  };

  function makeChain() {
    const chain: Record<string, (...args: unknown[]) => unknown> & {
      then?: (
        resolve: (value: {
          count: number;
          data: QueryResult['data'];
          error: QueryResult['error'];
        }) => unknown
      ) => Promise<unknown>;
    } = {};
    const passthrough =
      (method: string) =>
      (...args: unknown[]) => {
        chainCalls.push({ method, args });
        return chain;
      };

    for (const method of [
      'select',
      'eq',
      'or',
      'gte',
      'lte',
      'order',
      'range',
    ]) {
      chain[method] = passthrough(method);
    }

    chain.then = (resolve) => Promise.resolve(result).then(resolve);

    return chain;
  }

  return {
    chainCalls,
    from: vi.fn(() => makeChain()),
    reset: () => {
      chainCalls.length = 0;
      result = {
        count: 1,
        data: [{ id: 'order-1', order_items: [{ id: 'item-1' }] }],
        error: null,
      };
    },
    setResult: (nextResult: QueryResult) => {
      result = nextResult;
    },
  };
});

const queryMock = vi.hoisted(() => ({
  useInfiniteQuery: vi.fn((config) => config),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: supabaseMock.from,
  },
}));

vi.mock('@/lib/orders', () => ({
  ORDER_COLUMNS: 'id, order_items(id)',
}));

vi.mock('@/lib/sanitize', () => ({
  sanitizeSearchQuery: (value: string) => value.trim(),
}));

vi.mock('@/schemas/branch', () => ({
  ALL_BRANCH_SCOPE: { type: 'all' },
}));

vi.mock('../useBranchScope', () => ({
  useBranchScope: () => ({ scope: { type: 'all' } }),
}));

vi.mock('../useMerchant', () => ({
  useMerchant: () => ({ merchant: { id: 'merchant-1' } }),
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>(
    '@tanstack/react-query'
  );

  return {
    ...actual,
    useInfiniteQuery: queryMock.useInfiniteQuery,
  };
});

import { fetchOrders, useOrders } from './useOrdersList';

describe('fetchOrders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMock.reset();
  });

  it('applies branch_id only when a concrete branch scope is selected', async () => {
    await fetchOrders(
      'merchant-1',
      0,
      {},
      {
        type: 'branch',
        branchId: 'branch-1',
      }
    );

    expect(
      supabaseMock.chainCalls.filter(
        (call) => call.method === 'eq' && call.args[0] === 'branch_id'
      )
    ).toEqual([{ method: 'eq', args: ['branch_id', 'branch-1'] }]);
  });

  it('does not apply branch_id for all-location scope', async () => {
    await fetchOrders('merchant-1', 0, {}, { type: 'all' });

    expect(
      supabaseMock.chainCalls.filter(
        (call) => call.method === 'eq' && call.args[0] === 'branch_id'
      )
    ).toEqual([]);
  });

  it('throws when the branch-scoped orders query fails', async () => {
    supabaseMock.setResult({
      count: 0,
      data: [],
      error: { message: 'Orders unavailable' },
    });

    await expect(
      fetchOrders(
        'merchant-1',
        0,
        {},
        {
          type: 'branch',
          branchId: 'branch-1',
        }
      )
    ).rejects.toThrow('Orders unavailable');
  });

  it('throws when the all-location orders query fails', async () => {
    supabaseMock.setResult({
      count: 0,
      data: [],
      error: { message: 'Orders unavailable' },
    });

    await expect(
      fetchOrders('merchant-1', 0, {}, { type: 'all' })
    ).rejects.toThrow('Orders unavailable');
  });

  it('applies search, status, date range, pagination, and item counts', async () => {
    await expect(
      fetchOrders(
        'merchant-1',
        20,
        {
          status: 'delivered',
          search: '  Ada  ',
          dateFilter: {
            start: new Date('2026-05-01T12:00:00.000Z'),
            end: new Date('2026-05-03T12:00:00.000Z'),
          },
        },
        { type: 'all' }
      )
    ).resolves.toEqual({
      nextCursor: null,
      orders: [
        expect.objectContaining({
          id: 'order-1',
          item_count: 1,
          order_items: undefined,
        }),
      ],
      totalCount: 1,
    });

    expect(supabaseMock.chainCalls).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['shipping_status', 'delivered'] },
        {
          method: 'or',
          args: [
            'order_number.ilike.%Ada%,customer_name.ilike.%Ada%,customer_email.ilike.%Ada%',
          ],
        },
        { method: 'range', args: [20, 39] },
      ])
    );
    expect(
      supabaseMock.chainCalls.filter((call) => call.method === 'gte')
    ).toHaveLength(1);
    expect(
      supabaseMock.chainCalls.filter((call) => call.method === 'lte')
    ).toHaveLength(1);
  });

  it('configures the useOrders infinite query with branch-scope cache keys', async () => {
    const query = useOrders('pending', 'order-1', 'Today') as unknown as {
      enabled: boolean;
      queryFn: (input: { pageParam?: number }) => Promise<unknown>;
      queryKey: unknown[];
    };

    expect(queryMock.useInfiniteQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        queryKey: [
          'orders',
          'merchant-1',
          {
            dateFilter: 'Today',
            search: 'order-1',
            status: 'pending',
          },
          'all',
        ],
      })
    );

    await query.queryFn({ pageParam: 0 });

    expect(supabaseMock.chainCalls).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['merchant_id', 'merchant-1'] },
        { method: 'eq', args: ['shipping_status', 'pending'] },
      ])
    );
  });
});
