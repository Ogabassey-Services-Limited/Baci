import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BranchScope } from '@/schemas/branch';

const mocks = vi.hoisted(() => ({
  apiClient: vi.fn(),
  branchScope: { type: 'branch', branchId: 'branch-1' } as BranchScope,
  queryPromises: [] as Array<Promise<unknown>>,
  queryState: null as {
    data?: unknown;
    error: Error | null;
    isError: boolean;
    isLoading: boolean;
    status: 'error' | 'pending' | 'success';
  } | null,
}));

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

vi.mock('@/lib/api-client', () => ({
  apiClient: mocks.apiClient,
}));

import { useAnalyticsOverview } from '@/hooks/useAnalyticsOverview';

const range = {
  startDate: new Date('2026-05-01T00:00:00.000Z'),
  endDate: new Date('2026-05-05T00:00:00.000Z'),
};

describe('useAnalyticsOverview', () => {
  beforeEach(() => {
    mocks.apiClient.mockClear();
    mocks.branchScope = { type: 'branch', branchId: 'branch-1' };
    mocks.queryPromises.length = 0;
    mocks.queryState = null;
  });

  it('passes branchId to the analytics API for concrete branch scope', async () => {
    useAnalyticsOverview(range);
    await Promise.all(mocks.queryPromises);

    expect(mocks.apiClient).toHaveBeenCalledWith(
      '/api/analytics?endDate=2026-05-05T00%3A00%3A00.000Z&startDate=2026-05-01T00%3A00%3A00.000Z&branchId=branch-1',
      { headers: { 'x-baci-merchant-id': 'merchant-1' } }
    );
  });

  it('omits branchId from the analytics API for all-location scope', async () => {
    mocks.branchScope = { type: 'all' };

    useAnalyticsOverview(range);
    await Promise.all(mocks.queryPromises);

    expect(mocks.apiClient).toHaveBeenCalledWith(
      '/api/analytics?endDate=2026-05-05T00%3A00%3A00.000Z&startDate=2026-05-01T00%3A00%3A00.000Z',
      { headers: { 'x-baci-merchant-id': 'merchant-1' } }
    );
  });

  it('returns query loading and error state from React Query', () => {
    const error = new Error('Analytics failed');
    mocks.queryState = {
      data: undefined,
      error,
      isError: true,
      isLoading: false,
      status: 'error',
    };

    const result = useAnalyticsOverview(range);

    expect(result.error).toBe(error);
    expect(result.isError).toBe(true);
  });
});
