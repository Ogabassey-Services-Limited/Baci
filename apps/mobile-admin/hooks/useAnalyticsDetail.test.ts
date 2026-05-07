import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BranchScope } from '@/schemas/branch';

const mocks = vi.hoisted(() => ({
  branchScope: { type: 'branch', branchId: 'branch-1' } as BranchScope,
  chains: [] as Array<{
    table: string;
    calls: Array<{ method: string; args: unknown[] }>;
  }>,
  queryPromises: [] as Array<Promise<unknown>>,
  queryState: null as {
    data?: unknown;
    error: Error | null;
    isError: boolean;
    isLoading: boolean;
    status: 'error' | 'pending' | 'success';
  } | null,
}));

function makeChain(table: string) {
  const record = {
    table,
    calls: [] as Array<{ method: string; args: unknown[] }>,
  };
  mocks.chains.push(record);
  const chain: Record<string, unknown> = {};
  const passthrough =
    (method: string) =>
    (...args: unknown[]) => {
      record.calls.push({ method, args });
      return chain;
    };

  for (const method of ['select', 'eq', 'gte', 'lte']) {
    chain[method] = passthrough(method);
  }
  chain.then = (
    resolve: (value: { data: unknown[]; error: null }) => unknown
  ) => Promise.resolve({ data: [], error: null }).then(resolve);
  return chain;
}

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({
    enabled = true,
    queryFn,
  }: {
    enabled?: boolean;
    queryFn: () => Promise<unknown>;
  }) => {
    if (enabled) {
      mocks.queryPromises.push(Promise.resolve(queryFn()));
    }

    return (
      mocks.queryState ?? {
        data: undefined,
        error: null,
        isError: false,
        isLoading: false,
        status: 'success',
      }
    );
  },
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({ merchant: { id: 'merchant-1' } }),
}));

vi.mock('@/hooks/useBranchScope', () => ({
  useBranchScope: () => ({ scope: mocks.branchScope }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { from: (table: string) => makeChain(table) },
}));

import { useAnalyticsDetail } from '@/hooks/useAnalyticsDetail';

const options = {
  endDate: '2026-05-05T00:00:00.000Z',
  filterLabel: 'Last 7 days',
  granularity: 'weekday' as const,
  metric: 'revenue' as const,
  startDate: '2026-05-01T00:00:00.000Z',
};

describe('useAnalyticsDetail', () => {
  beforeEach(() => {
    mocks.chains.length = 0;
    mocks.branchScope = { type: 'branch', branchId: 'branch-1' };
    mocks.queryPromises.length = 0;
    mocks.queryState = null;
  });

  it('filters order and order-item analytics by selected branch scope', async () => {
    renderHook(() => useAnalyticsDetail(options));
    await Promise.all(mocks.queryPromises);

    expect(
      mocks.chains.flatMap((chain) =>
        chain.calls
          .filter(
            (call) =>
              call.method === 'eq' &&
              (call.args[0] === 'branch_id' ||
                call.args[0] === 'orders.branch_id')
          )
          .map((call) => ({
            table: chain.table,
            column: call.args[0],
            value: call.args[1],
          }))
      )
    ).toEqual([
      { table: 'orders', column: 'branch_id', value: 'branch-1' },
      {
        table: 'order_items',
        column: 'orders.branch_id',
        value: 'branch-1',
      },
    ]);
  });

  it('omits branch filters for all-location analytics detail scope', async () => {
    mocks.branchScope = { type: 'all' };

    renderHook(() => useAnalyticsDetail(options));
    await Promise.all(mocks.queryPromises);

    expect(
      mocks.chains.flatMap((chain) =>
        chain.calls.filter(
          (call) =>
            call.method === 'eq' &&
            (call.args[0] === 'branch_id' ||
              call.args[0] === 'orders.branch_id')
        )
      )
    ).toEqual([]);
  });

  it('returns query errors from React Query', () => {
    const error = new Error('Detail failed');
    mocks.queryState = {
      data: undefined,
      error,
      isError: true,
      isLoading: false,
      status: 'error',
    };

    const { result } = renderHook(() => useAnalyticsDetail(options));

    expect(result.current.error).toBe(error);
    expect(result.current.isError).toBe(true);
  });
});
