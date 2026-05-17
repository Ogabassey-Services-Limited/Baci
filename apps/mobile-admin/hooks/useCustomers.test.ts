import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCustomer } from '@/hooks/useCustomers';

const mocks = vi.hoisted(() => ({
  eqCalls: [] as Array<{ column: string; table: string; value: unknown }>,
  from: vi.fn(),
  merchant: { id: 'merchant-a' } as { id: string } | null,
}));

vi.mock('@baci/shared', () => ({
  buildCustomerAddressLine: vi.fn(() => null),
  buildCustomerNameFields: vi.fn(() => ({})),
  buildCustomerSearchFilter: vi.fn(() => ''),
  CUSTOMER_ADMIN_COLUMNS: 'id, merchant_id, full_name',
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({ merchant: mocks.merchant }),
}));

vi.mock('@/lib/sanitize', () => ({
  sanitizeSearchQuery: (value: string) => value.trim(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      mocks.from(table);

      const query: Record<string, unknown> = {};
      query.select = vi.fn(() => query);
      query.eq = vi.fn((column: string, value: unknown) => {
        mocks.eqCalls.push({ column, table, value });
        return query;
      });
      query.order = vi.fn(() => query);
      query.single = vi.fn(async () => ({
        data: {
          id: 'customer-1',
          merchant_id: mocks.merchant?.id ?? null,
          full_name: 'Ada Customer',
        },
        error: null,
      }));
      query.limit = vi.fn(async () => ({ data: [], error: null }));

      return query;
    },
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  }

  return { queryClient, Wrapper };
}

describe('useCustomer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.eqCalls = [];
    mocks.merchant = { id: 'merchant-a' };
  });

  it('keys cached customer details by merchant so stale data is not reused across merchant switches', async () => {
    const { queryClient, Wrapper } = createWrapper();
    const { rerender, result } = renderHook(() => useCustomer('customer-1'), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mocks.eqCalls).toContainEqual({
      column: 'merchant_id',
      table: 'customers',
      value: 'merchant-a',
    });
    expect(
      queryClient.getQueryCache().find({
        queryKey: ['customer', 'customer-1', 'merchant-a'],
      })
    ).toBeDefined();

    mocks.eqCalls = [];
    mocks.merchant = { id: 'merchant-b' };
    rerender();

    await waitFor(() =>
      expect(mocks.eqCalls).toContainEqual({
        column: 'merchant_id',
        table: 'customers',
        value: 'merchant-b',
      })
    );
    expect(
      queryClient.getQueryCache().find({
        queryKey: ['customer', 'customer-1', 'merchant-b'],
      })
    ).toBeDefined();
  });
});
