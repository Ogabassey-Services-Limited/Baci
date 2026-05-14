import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  chainCalls: [] as Array<{ method: string; args: unknown[] }>,
  productQueryResult: {
    count: 0,
    data: [] as unknown[],
    error: null as { message: string } | null,
  },
  queryPromises: [] as Array<Promise<unknown>>,
  rpc: vi.fn(),
}));

function makeProductQuery() {
  const chain: Record<string, unknown> = {};
  const passthrough =
    (method: string) =>
    (...args: unknown[]) => {
      mocks.chainCalls.push({ method, args });
      return chain;
    };

  for (const method of [
    'select',
    'eq',
    'is',
    'order',
    'range',
    'lte',
    'gt',
    'or',
  ]) {
    chain[method] = passthrough(method);
  }
  chain.then = (
    resolve: (value: {
      data: unknown[];
      count: number;
      error: { message: string } | null;
    }) => unknown
  ) => Promise.resolve(mocks.productQueryResult).then(resolve);
  return chain;
}

vi.mock('@tanstack/react-query', () => ({
  keepPreviousData: Symbol('keepPreviousData'),
  useInfiniteQuery: ({
    queryFn,
  }: {
    queryFn: (args: { pageParam?: number }) => Promise<unknown>;
  }) => {
    mocks.queryPromises.push(queryFn({ pageParam: 0 }));
    return {};
  },
  useMutation: () => ({}),
  useQuery: ({ queryFn }: { queryFn: () => Promise<unknown> }) => {
    mocks.queryPromises.push(queryFn());
    return {};
  },
  useQueryClient: () => ({}),
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({ merchant: { id: 'merchant-1' } }),
}));

vi.mock('@/hooks/useBranchScope', () => ({
  useBranchScope: () => ({
    scope: { type: 'branch', branchId: 'branch-1' },
  }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => makeProductQuery(),
    rpc: mocks.rpc,
  },
}));

import { useInventoryStats, useProducts } from './useProducts';

describe('useProducts branch semantics', () => {
  beforeEach(() => {
    mocks.chainCalls.length = 0;
    mocks.queryPromises.length = 0;
    mocks.productQueryResult = { count: 0, data: [], error: null };
    mocks.rpc.mockReset();
  });

  it('does not add branch_id filters to merchant-wide product catalog queries', () => {
    useProducts();

    expect(mocks.chainCalls.length).toBeGreaterThan(0);
    expect(
      mocks.chainCalls.filter(
        (call) => call.method === 'eq' && call.args[0] === 'branch_id'
      )
    ).toEqual([]);
  });

  it('calls inventory stats RPC only with merchant id', () => {
    mocks.rpc.mockResolvedValue({ data: {}, error: null });

    useInventoryStats();

    expect(mocks.rpc).toHaveBeenCalledWith('get_merchant_inventory_stats', {
      p_merchant_id: 'merchant-1',
    });
  });

  it('surfaces inventory stats RPC errors', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: 'rpc-failed' },
    });

    useInventoryStats();

    await expect(mocks.queryPromises[0]).rejects.toEqual({
      message: 'rpc-failed',
    });
    expect(mocks.rpc).toHaveBeenCalledWith('get_merchant_inventory_stats', {
      p_merchant_id: 'merchant-1',
    });
  });

  it('surfaces product query errors without adding branch filters', async () => {
    mocks.productQueryResult = {
      count: 0,
      data: [],
      error: { message: 'query-failed' },
    };

    useProducts();

    await expect(mocks.queryPromises[0]).rejects.toThrow('query-failed');
    expect(
      mocks.chainCalls.filter(
        (call) => call.method === 'eq' && call.args[0] === 'branch_id'
      )
    ).toEqual([]);
  });
});
