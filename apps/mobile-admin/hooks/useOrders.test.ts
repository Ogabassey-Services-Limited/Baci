import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useInfiniteQuery: vi.fn(),
  useMutation: vi.fn(),
  useQuery: vi.fn(),
  useQueryClient: vi.fn(() => ({})),
  useMerchant: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: mocks.useInfiniteQuery,
  useMutation: mocks.useMutation,
  useQuery: mocks.useQuery,
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

vi.mock('@/lib/supabase-utils', () => ({
  getJoinedRecord: vi.fn(),
}));

vi.mock('./order-request', () => ({
  getAuthenticatedHeaders: vi.fn(),
  readResponseError: vi.fn(),
  runWithTimeout: vi.fn(),
}));

vi.mock('./useMerchant', () => ({
  useMerchant: mocks.useMerchant,
}));

import { PAGE_SIZE, useOrders } from './useOrders';

describe('useOrders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useInfiniteQuery.mockImplementation((config) => config);
    mocks.useMerchant.mockReturnValue({
      merchant: { id: 'merchant-1' },
    });
  });

  it('keeps the merchant-scoped orders query key unchanged', () => {
    const { result } = renderHook(() => useOrders());
    const query = result.current as unknown as {
      queryKey: [string, string, Record<string, unknown>];
      enabled: boolean;
    };

    expect(PAGE_SIZE).toBe(20);
    expect(query.queryKey).toEqual([
      'orders',
      'merchant-1',
      {
        status: undefined,
        search: undefined,
        dateFilter: undefined,
      },
    ]);
    expect(query.enabled).toBe(true);
  });

  it('disables the orders query until the merchant is known', () => {
    mocks.useMerchant.mockReturnValue({
      merchant: null,
    });

    const { result } = renderHook(() => useOrders('processing', 'john'));
    const query = result.current as unknown as {
      queryKey: [string, undefined, Record<string, unknown>];
      enabled: boolean;
    };

    expect(query.queryKey).toEqual([
      'orders',
      undefined,
      {
        status: 'processing',
        search: 'john',
        dateFilter: undefined,
      },
    ]);
    expect(query.enabled).toBe(false);
  });
});
