import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => {
  type ChainCall = { method: string; args: unknown[] };
  const chainCalls: ChainCall[] = [];
  let result: {
    data: unknown[];
    count: number;
    error: { message: string } | null;
  } = {
    data: [{ id: 'order-1', order_items: [{ id: 'item-1' }] }],
    count: 1,
    error: null,
  };

  function makeChain() {
    const chain: Record<string, unknown> = {};
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
    from: vi.fn(() => makeChain()),
    reset: () => {
      chainCalls.length = 0;
      result = {
        data: [{ id: 'order-1', order_items: [{ id: 'item-1' }] }],
        count: 1,
        error: null,
      };
    },
    setResult: (nextResult: typeof result) => {
      result = nextResult;
    },
  };
});

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

import { fetchOrders } from './useOrders';

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
});
