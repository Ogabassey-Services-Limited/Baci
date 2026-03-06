import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const queryClient = {
    cancelQueries: vi.fn(),
    getQueriesData: vi.fn(),
    setQueriesData: vi.fn(),
    getQueryData: vi.fn(),
    setQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
  };

  return {
    queryClient,
    useMutation: vi.fn(),
    useQueryClient: vi.fn(() => queryClient),
    useMerchant: vi.fn(),
  };
});

vi.mock('@tanstack/react-query', () => ({
  useMutation: mocks.useMutation,
  useQueryClient: mocks.useQueryClient,
}));

vi.mock('@/lib/api-client', () => ({
  BASE_URL: 'https://example.com',
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock('./order-request', () => ({
  getAuthenticatedHeaders: vi.fn(),
  readResponseError: vi.fn(),
  runWithTimeout: vi.fn(),
}));

vi.mock('./useMerchant', () => ({
  useMerchant: mocks.useMerchant,
}));

import { useUpdateOrderStatus } from './useOrderMutations';

describe('useOrderMutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useMutation.mockImplementation((config) => config);
    mocks.useMerchant.mockReturnValue({
      merchant: { id: 'merchant-1' },
    });
  });

  it('keeps the orders invalidation keys unchanged after status updates settle', () => {
    const { result } = renderHook(() => useUpdateOrderStatus());
    const mutation = result.current as unknown as {
      onSettled: () => void;
    };

    mutation.onSettled();

    expect(mocks.queryClient.invalidateQueries).toHaveBeenNthCalledWith(1, {
      queryKey: ['orders', 'merchant-1'],
    });
    expect(mocks.queryClient.invalidateQueries).toHaveBeenNthCalledWith(2, {
      queryKey: ['dashboard-stats', 'merchant-1'],
    });
    expect(mocks.queryClient.invalidateQueries).toHaveBeenNthCalledWith(3, {
      queryKey: ['order-counts', 'merchant-1'],
    });
  });
});
