import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => {
  type ChainCall = { method: string; args: unknown[] };
  const chainCalls: ChainCall[] = [];
  const chains: Array<{ table: string; calls: ChainCall[] }> = [];
  let result: {
    data: unknown[];
    count: number;
    error: { message: string } | null;
  } = {
    data: [{ id: 'order-1', order_items: [{ id: 'item-1' }] }],
    count: 1,
    error: null,
  };
  let orderDetailResult = {
    data: {
      id: 'order-1',
      total: 100,
      wallet_amount_used: 0,
      recorded_by_user_id: null,
    },
    error: null as { message: string } | null,
  };

  function makeChain(table: string) {
    const chain: Record<string, unknown> = {};
    const calls: ChainCall[] = [];
    chains.push({ table, calls });
    const passthrough =
      (method: string) =>
      (...args: unknown[]) => {
        const call = { method, args };
        chainCalls.push(call);
        calls.push(call);
        return chain;
      };

    for (const method of [
      'select',
      'eq',
      'in',
      'or',
      'gte',
      'lte',
      'order',
      'range',
    ]) {
      chain[method] = passthrough(method);
    }
    chain.single = () => Promise.resolve(orderDetailResult);
    chain.maybeSingle = () => Promise.resolve({ data: null, error: null });
    chain.then = (
      resolve: (value: {
        data: unknown[];
        count: number;
        error: { message: string } | null;
      }) => unknown
    ) => Promise.resolve(result).then(resolve);
    return chain;
  }

  return {
    chainCalls,
    chains,
    from: vi.fn((table: string) => makeChain(table)),
    reset: () => {
      chainCalls.length = 0;
      chains.length = 0;
      result = {
        data: [{ id: 'order-1', order_items: [{ id: 'item-1' }] }],
        count: 1,
        error: null,
      };
      orderDetailResult = {
        data: {
          id: 'order-1',
          total: 100,
          wallet_amount_used: 0,
          recorded_by_user_id: null,
        },
        error: null,
      };
    },
    setResult: (nextResult: typeof result) => {
      result = nextResult;
    },
  };
});

const queryClientMock = vi.hoisted(() => ({
  cancelQueries: vi.fn(),
  getQueriesData: vi.fn(),
  invalidateQueries: vi.fn(),
  setQueriesData: vi.fn(),
  setQueryData: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn() },
    from: supabaseMock.from,
  },
}));

vi.mock('@/lib/api-client', () => ({
  BASE_URL: 'https://example.test',
}));

vi.mock('./useMerchant', () => ({
  useMerchant: () => ({ merchant: { id: 'merchant-1' } }),
}));

vi.mock('./useBranchScope', () => ({
  useBranchScope: () => ({ scope: { type: 'all' } }),
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>(
    '@tanstack/react-query'
  );
  return {
    ...actual,
    useMutation: vi.fn((config) => config),
    useQueryClient: () => queryClientMock,
  };
});

import { fetchOrderById, fetchOrders, useUpdateOrderStatus } from './useOrders';

describe('fetchOrders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMock.reset();
    queryClientMock.getQueriesData.mockReturnValue([]);
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
      data: [],
      count: 0,
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
      data: [],
      count: 0,
      error: { message: 'Orders unavailable' },
    });

    await expect(
      fetchOrders('merchant-1', 0, {}, { type: 'all' })
    ).rejects.toThrow('Orders unavailable');
  });

  it('applies branch scope when fetching a single order by id', async () => {
    await fetchOrderById('order-1', 'merchant-1', {
      type: 'branch',
      branchId: 'branch-1',
    });

    const orderQuery = supabaseMock.chains.find(
      (chain) => chain.table === 'orders'
    );

    expect(orderQuery?.calls).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['id', 'order-1'] },
        { method: 'eq', args: ['merchant_id', 'merchant-1'] },
        { method: 'eq', args: ['branch_id', 'branch-1'] },
      ])
    );
  });
});

describe('useUpdateOrderStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClientMock.getQueriesData.mockReturnValue([]);
  });

  it('optimistically updates and rolls back all scoped order detail caches', async () => {
    const mutation = useUpdateOrderStatus() as unknown as {
      onError: (
        error: Error,
        vars: { orderId: string; status: string },
        context?: {
          previousOrderQueries?: Array<[readonly unknown[], unknown]>;
          previousOrders?: Array<[readonly unknown[], unknown]>;
        }
      ) => void;
      onMutate: (vars: {
        orderId: string;
        status: string;
      }) => Promise<{
        previousOrderQueries: Array<[readonly unknown[], unknown]>;
        previousOrders: Array<[readonly unknown[], unknown]>;
      }>;
      onSettled: (
        data: unknown,
        error: unknown,
        vars: { orderId: string; status: string }
      ) => void;
    };
    const previousOrder = { id: 'order-1', shipping_status: 'pending' };
    const scopedKey = ['order', 'order-1', 'merchant-1', 'branch-1'] as const;
    queryClientMock.getQueriesData
      .mockReturnValueOnce([])
      .mockReturnValueOnce([[scopedKey, previousOrder]]);

    const context = await mutation.onMutate({
      orderId: 'order-1',
      status: 'shipped',
    });

    expect(queryClientMock.cancelQueries).toHaveBeenCalledWith({
      queryKey: ['order', 'order-1'],
    });
    expect(queryClientMock.getQueriesData).toHaveBeenCalledWith({
      queryKey: ['order', 'order-1'],
    });
    expect(queryClientMock.setQueriesData).toHaveBeenCalledWith(
      { queryKey: ['order', 'order-1'] },
      expect.any(Function)
    );
    const detailUpdater = queryClientMock.setQueriesData.mock.calls.find(
      ([filters]) =>
        (filters as { queryKey?: unknown[] }).queryKey?.[0] === 'order'
    )?.[1];
    expect(detailUpdater).toBeDefined();
    const updateDetail = detailUpdater as (
      order: typeof previousOrder
    ) => typeof previousOrder;
    expect(updateDetail(previousOrder)).toEqual({
      id: 'order-1',
      shipping_status: 'shipped',
    });

    mutation.onError(new Error('boom'), {
      orderId: 'order-1',
      status: 'shipped',
    }, context);

    expect(queryClientMock.setQueryData).toHaveBeenCalledWith(
      scopedKey,
      previousOrder
    );

    mutation.onSettled(null, null, {
      orderId: 'order-1',
      status: 'shipped',
    });
    expect(queryClientMock.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['order', 'order-1'],
    });
  });
});
