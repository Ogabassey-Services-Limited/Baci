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

    for (const method of ['select', 'eq', 'not', 'or']) {
      chain[method] = passthrough(method);
    }
    Object.defineProperty(chain, 'then', {
      value: (
        resolve: (value: {
          count: number;
          error: { message: string } | null;
        }) => unknown
      ) =>
        Promise.resolve(results.shift() ?? { count: 1, error: null }).then(
          resolve
        ),
    });
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

import {
  HIDDEN_CHECKOUT_PAYMENT_STATUSES,
  VISIBLE_PENDING_ORDER_FILTER,
} from './orders/order-list-visibility';
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
    ).toEqual(
      Array.from({ length: 8 }, () => ({
        method: 'eq',
        args: ['branch_id', 'branch-1'],
      }))
    );
    expect(
      supabaseMock.chains.map((calls) =>
        calls.find(
          (call) => call.method === 'eq' && call.args[0] === 'merchant_id'
        )
      )
    ).toEqual(
      Array.from({ length: 8 }, () => ({
        method: 'eq',
        args: ['merchant_id', 'merchant-1'],
      }))
    );
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
    ).toEqual(
      Array.from({ length: 8 }, () => ({
        method: 'eq',
        args: ['merchant_id', 'merchant-1'],
      }))
    );
  });

  it('counts paid orders by payment status while keeping fulfillment status counts', async () => {
    await fetchOrderCounts('merchant-1', { type: 'all' });

    expect(supabaseMock.chains[1]).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['payment_status', 'paid'] },
      ])
    );
    expect(supabaseMock.chains[1]).not.toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['shipping_status', 'paid'] },
      ])
    );
    expect(supabaseMock.chains[2]).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['shipping_status', 'pending'] },
      ])
    );
  });

  it('keeps checkout drop-offs out of every order count', async () => {
    await fetchOrderCounts('merchant-1', { type: 'all' });

    for (const calls of supabaseMock.chains) {
      expect(calls).toEqual(
        expect.arrayContaining([
          {
            method: 'not',
            args: ['payment_status', 'in', HIDDEN_CHECKOUT_PAYMENT_STATUSES],
          },
          {
            method: 'or',
            args: [VISIBLE_PENDING_ORDER_FILTER],
          },
        ])
      );
    }
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
