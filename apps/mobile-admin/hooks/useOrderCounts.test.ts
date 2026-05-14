import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => {
  type ChainCall = { method: string; args: unknown[] };
  const chains: ChainCall[][] = [];
  const results: Array<{ count: number; error: { message: string } | null }> =
    [];

  function makeChain() {
    const calls: ChainCall[] = [];
    chains.push(calls);
    const chain: Record<string, unknown> = {};
    const passthrough =
      (method: string) =>
      (...args: unknown[]) => {
        calls.push({ method, args });
        return chain;
      };

    for (const method of ['select', 'eq']) {
      chain[method] = passthrough(method);
    }
    chain.then = (
      resolve: (value: {
        count: number;
        error: { message: string } | null;
      }) => unknown
    ) =>
      Promise.resolve(results.shift() ?? { count: 1, error: null }).then(
        resolve
      );
    return chain;
  }

  return {
    chains,
    enqueue: (
      nextResults: Array<{ count: number; error: { message: string } | null }>
    ) => {
      results.push(...nextResults);
    },
    from: vi.fn(() => makeChain()),
    reset: () => {
      chains.length = 0;
      results.length = 0;
    },
  };
});

vi.mock('@/lib/supabase', () => ({
  supabase: { from: supabaseMock.from },
}));

vi.mock('./useMerchant', () => ({
  useMerchant: () => ({ merchant: { id: 'merchant-1' } }),
}));

vi.mock('./useBranchScope', () => ({
  useBranchScope: () => ({ scope: { type: 'all' } }),
}));

import { fetchOrderCounts } from './useOrderCounts';

describe('fetchOrderCounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMock.reset();
  });

  it('applies the selected branch to every order status count', async () => {
    await fetchOrderCounts('merchant-1', {
      type: 'branch',
      branchId: 'branch-1',
    });

    expect(
      supabaseMock.chains.map((calls) =>
        calls.find(
          (call) => call.method === 'eq' && call.args[0] === 'branch_id'
        )
      )
    ).toEqual([
      { method: 'eq', args: ['branch_id', 'branch-1'] },
      { method: 'eq', args: ['branch_id', 'branch-1'] },
      { method: 'eq', args: ['branch_id', 'branch-1'] },
      { method: 'eq', args: ['branch_id', 'branch-1'] },
      { method: 'eq', args: ['branch_id', 'branch-1'] },
      { method: 'eq', args: ['branch_id', 'branch-1'] },
      { method: 'eq', args: ['branch_id', 'branch-1'] },
    ]);
    expect(
      supabaseMock.chains.map((calls) =>
        calls.find(
          (call) => call.method === 'eq' && call.args[0] === 'merchant_id'
        )
      )
    ).toEqual([
      { method: 'eq', args: ['merchant_id', 'merchant-1'] },
      { method: 'eq', args: ['merchant_id', 'merchant-1'] },
      { method: 'eq', args: ['merchant_id', 'merchant-1'] },
      { method: 'eq', args: ['merchant_id', 'merchant-1'] },
      { method: 'eq', args: ['merchant_id', 'merchant-1'] },
      { method: 'eq', args: ['merchant_id', 'merchant-1'] },
      { method: 'eq', args: ['merchant_id', 'merchant-1'] },
    ]);
  });

  it('does not add branch filters for all-location counts', async () => {
    await fetchOrderCounts('merchant-1', { type: 'all' });

    expect(
      supabaseMock.chains.flatMap((calls) =>
        calls.filter(
          (call) => call.method === 'eq' && call.args[0] === 'branch_id'
        )
      )
    ).toEqual([]);
    expect(
      supabaseMock.chains.map((calls) =>
        calls.find(
          (call) => call.method === 'eq' && call.args[0] === 'merchant_id'
        )
      )
    ).toEqual([
      { method: 'eq', args: ['merchant_id', 'merchant-1'] },
      { method: 'eq', args: ['merchant_id', 'merchant-1'] },
      { method: 'eq', args: ['merchant_id', 'merchant-1'] },
      { method: 'eq', args: ['merchant_id', 'merchant-1'] },
      { method: 'eq', args: ['merchant_id', 'merchant-1'] },
      { method: 'eq', args: ['merchant_id', 'merchant-1'] },
      { method: 'eq', args: ['merchant_id', 'merchant-1'] },
    ]);
  });

  it('throws query errors while preserving merchant and branch filters', async () => {
    supabaseMock.enqueue([
      { count: 0, error: { message: 'Count failed' } },
      { count: 1, error: null },
      { count: 1, error: null },
      { count: 1, error: null },
      { count: 1, error: null },
      { count: 1, error: null },
      { count: 1, error: null },
    ]);

    await expect(
      fetchOrderCounts('merchant-1', {
        type: 'branch',
        branchId: 'branch-1',
      })
    ).rejects.toThrow('Count failed');

    expect(
      supabaseMock.chains[0].filter((call) => call.method === 'eq')
    ).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['merchant_id', 'merchant-1'] },
        { method: 'eq', args: ['branch_id', 'branch-1'] },
      ])
    );
  });
});
