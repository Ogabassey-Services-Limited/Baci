import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  chainCalls: [] as Array<{ method: string; args: unknown[] }>,
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
    resolve: (value: { data: unknown[]; count: number; error: null }) => unknown
  ) => Promise.resolve({ data: [], count: 0, error: null }).then(resolve);
  return chain;
}

vi.mock('@tanstack/react-query', () => ({
  keepPreviousData: Symbol('keepPreviousData'),
  useInfiniteQuery: ({ queryFn }: { queryFn: (args: { pageParam?: number }) => Promise<unknown> }) => {
    void queryFn({ pageParam: 0 });
    return {};
  },
  useMutation: () => ({}),
  useQuery: ({ queryFn }: { queryFn: () => Promise<unknown> }) => {
    void queryFn();
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
});
