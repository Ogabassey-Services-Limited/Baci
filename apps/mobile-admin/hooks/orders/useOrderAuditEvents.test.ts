import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => {
  const chains: Array<{
    calls: Array<{ args: unknown[]; method: string }>;
    table: string;
  }> = [];
  let result: { data: unknown; error: { message: string } | null } = {
    data: [],
    error: null,
  };

  function makeChain(table: string) {
    const calls: Array<{ args: unknown[]; method: string }> = [];
    const chain: Record<string, (...args: unknown[]) => unknown> & {
      then?: (resolve: (value: typeof result) => unknown) => Promise<unknown>;
    } = {};
    chains.push({ calls, table });

    for (const method of ['select', 'eq', 'order', 'limit']) {
      chain[method] = (...args: unknown[]) => {
        calls.push({ args, method });
        return chain;
      };
    }

    // biome-ignore lint/suspicious/noThenProperty: Mocking a Supabase promise chain
    chain.then = (resolve) => Promise.resolve(result).then(resolve);
    return chain;
  }

  return {
    chains,
    from: vi.fn((table: string) => makeChain(table)),
    reset: () => {
      chains.length = 0;
      result = { data: [], error: null };
    },
    setResult: (nextResult: typeof result) => {
      result = nextResult;
    },
  };
});

const queryMock = vi.hoisted(() => ({
  useQuery: vi.fn((config) => config),
}));

const branchScopeState = vi.hoisted(() => ({
  current: { type: 'all' } as
    | { type: 'all' }
    | { type: 'branch'; branchId: string },
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: supabaseMock.from,
  },
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: queryMock.useQuery,
}));

vi.mock('../useBranchScope', () => ({
  useBranchScope: () => ({ scope: branchScopeState.current }),
}));

import {
  fetchOrderAuditEvents,
  useOrderAuditEvents,
} from './useOrderAuditEvents';

describe('fetchOrderAuditEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMock.reset();
  });

  it('fetches latest audit events scoped to the order and merchant', async () => {
    supabaseMock.setResult({
      data: [
        {
          actor_user_id: 'actor-1',
          change_category: 'financial',
          changed_fields: ['items'],
          created_at: '2026-06-26T00:00:00.000Z',
          id: 'audit-1',
        },
      ],
      error: null,
    });

    await expect(
      fetchOrderAuditEvents('order-1', 'merchant-1')
    ).resolves.toEqual([
      {
        actor_user_id: 'actor-1',
        change_category: 'financial',
        changed_fields: ['items'],
        created_at: '2026-06-26T00:00:00.000Z',
        id: 'audit-1',
      },
    ]);

    const query = supabaseMock.chains.find(
      (chain) => chain.table === 'order_audit_events'
    );

    expect(query?.calls).toEqual(
      expect.arrayContaining([
        { args: ['order_id', 'order-1'], method: 'eq' },
        { args: ['merchant_id', 'merchant-1'], method: 'eq' },
      ])
    );
  });

  it('filters through the order branch when a branch scope is active', async () => {
    await fetchOrderAuditEvents('order-1', 'merchant-1', {
      branchId: 'branch-1',
      type: 'branch',
    });

    const query = supabaseMock.chains.find(
      (chain) => chain.table === 'order_audit_events'
    );

    expect(query?.calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          args: [expect.stringContaining('orders!inner(branch_id)')],
          method: 'select',
        }),
        { args: ['orders.branch_id', 'branch-1'], method: 'eq' },
      ])
    );
  });

  it('throws query errors', async () => {
    supabaseMock.setResult({
      data: null,
      error: { message: 'Audit unavailable' },
    });

    await expect(
      fetchOrderAuditEvents('order-1', 'merchant-1')
    ).rejects.toThrow('Audit unavailable');
  });
});

describe('useOrderAuditEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    branchScopeState.current = { type: 'all' };
  });

  it('uses an order-scoped query key and waits for ids', () => {
    const query = useOrderAuditEvents({
      merchantId: 'merchant-1',
      orderId: 'order-1',
    }) as unknown as {
      enabled: boolean;
      queryKey: unknown[];
    };

    expect(queryMock.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        queryKey: ['order-audit-events', 'order-1', 'merchant-1', 'all'],
      })
    );
    expect(query.enabled).toBe(true);
  });

  it('disables the query until order and merchant ids are available', () => {
    const query = useOrderAuditEvents({
      merchantId: null,
      orderId: 'order-1',
    }) as unknown as {
      enabled: boolean;
      queryKey: unknown[];
    };

    expect(query.enabled).toBe(false);
    expect(query.queryKey).toEqual([
      'order-audit-events',
      'order-1',
      null,
      'all',
    ]);
  });

  it('includes the selected branch in the query key', () => {
    branchScopeState.current = { branchId: 'branch-1', type: 'branch' };

    const query = useOrderAuditEvents({
      merchantId: 'merchant-1',
      orderId: 'order-1',
    }) as unknown as {
      queryKey: unknown[];
    };

    expect(query.queryKey).toEqual([
      'order-audit-events',
      'order-1',
      'merchant-1',
      'branch-1',
    ]);
  });
});
