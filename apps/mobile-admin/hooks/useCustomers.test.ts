import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCreateCustomer, useCustomer } from '@/hooks/useCustomers';

const mocks = vi.hoisted(() => ({
  eqCalls: [] as Array<{ column: string; table: string; value: unknown }>,
  from: vi.fn(),
  ilikeCalls: [] as Array<{ column: string; table: string; value: string }>,
  insertRows: [] as unknown[],
  limitResponses: {} as Record<
    string,
    {
      data: unknown[] | null;
      error: { message: string } | null;
    }
  >,
  nextInsertResponse: null as {
    data: unknown;
    error: { code?: string; message: string } | null;
  } | null,
  orCalls: [] as string[],
  merchant: { id: 'merchant-a' } as { id: string } | null,
}));

vi.mock('@baci/shared', () => ({
  buildCustomerAddressLine: vi.fn(() => null),
  buildCustomerNameFields: vi.fn(() => ({})),
  buildCustomerRecordNameFields: vi.fn(() => ({})),
  buildCustomerSearchFilter: vi.fn(() => ''),
  CUSTOMER_ADMIN_COLUMNS: 'id, merchant_id, full_name',
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({ merchant: mocks.merchant }),
}));

vi.mock('@/lib/sanitize', () => ({
  sanitizeEmail: (value: string) => value.toLowerCase().trim(),
  sanitizePhone: (value: string) => value.trim(),
  sanitizeSearchQuery: (value: string) => value.trim(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      mocks.from(table);

      let limitLookupKey = '';
      const query: Record<string, unknown> = {};
      query.select = vi.fn(() => query);
      query.eq = vi.fn((column: string, value: unknown) => {
        mocks.eqCalls.push({ column, table, value });
        if (column === 'phone') {
          limitLookupKey = `${table}:${column}:${String(value)}`;
        }
        return query;
      });
      query.ilike = vi.fn((column: string, value: string) => {
        mocks.ilikeCalls.push({ column, table, value });
        limitLookupKey = `${table}:${column}:${value}`;
        return query;
      });
      query.insert = vi.fn((row: unknown) => {
        mocks.insertRows.push(row);
        return query;
      });
      query.is = vi.fn(() => query);
      query.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
      query.order = vi.fn(() => query);
      query.or = vi.fn((filter: string) => {
        mocks.orCalls.push(filter);
        return query;
      });
      query.single = vi.fn(() => {
        if (mocks.nextInsertResponse) {
          return mocks.nextInsertResponse;
        }

        return {
          data: {
            id: 'customer-1',
            merchant_id: mocks.merchant?.id ?? null,
            full_name: 'Ada Customer',
          },
          error: null,
        };
      });
      query.limit = vi.fn(() => {
        return (
          mocks.limitResponses[limitLookupKey] ?? {
            data: [],
            error: null,
          }
        );
      });

      return query;
    },
  },
}));

function resetQueryTrackers() {
  vi.clearAllMocks();
  mocks.eqCalls = [];
  mocks.ilikeCalls = [];
  mocks.insertRows = [];
  mocks.limitResponses = {};
  mocks.nextInsertResponse = null;
  mocks.orCalls = [];
  mocks.merchant = { id: 'merchant-a' };
}

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
    resetQueryTrackers();
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

describe('useCreateCustomer', () => {
  beforeEach(() => {
    resetQueryTrackers();
  });

  it('normalizes customer email before duplicate lookup and insert', async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateCustomer(), {
      wrapper: Wrapper,
    });

    await result.current.mutateAsync({
      customer_type: 'individual',
      email: ' DavidChimezie2018@GMAIL.COM ',
      first_name: 'David',
      last_name: 'Chimezie',
      phone: ' 08062712682 ',
    });

    expect(mocks.orCalls).toEqual([]);
    expect(mocks.eqCalls).toContainEqual({
      column: 'phone',
      table: 'customers',
      value: '08062712682',
    });
    expect(mocks.ilikeCalls).toContainEqual({
      column: 'email',
      table: 'customers',
      value: 'davidchimezie2018@gmail.com',
    });
    expect(mocks.insertRows[0]).toMatchObject({
      email: 'davidchimezie2018@gmail.com',
      merchant_id: 'merchant-a',
      phone: '08062712682',
    });
  });

  it('rejects before insert when a normalized email matches an existing customer', async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateCustomer(), {
      wrapper: Wrapper,
    });

    mocks.limitResponses['customers:email:davidchimezie2018@gmail.com'] = {
      data: [{ id: 'customer-1' }],
      error: null,
    };

    await expect(
      result.current.mutateAsync({
        customer_type: 'individual',
        email: ' DavidChimezie2018@GMAIL.COM ',
        first_name: 'David',
        last_name: 'Chimezie',
        phone: '08062712682',
      })
    ).rejects.toThrow('Customer with this email or phone already exists');

    expect(mocks.ilikeCalls).toContainEqual({
      column: 'email',
      table: 'customers',
      value: 'davidchimezie2018@gmail.com',
    });
    expect(mocks.insertRows).toEqual([]);
  });

  it('maps customer unique constraint errors to the duplicate customer message', async () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateCustomer(), {
      wrapper: Wrapper,
    });

    mocks.nextInsertResponse = {
      data: null,
      error: {
        code: '23505',
        message:
          'duplicate key value violates unique constraint "customers_merchant_email_unique"',
      },
    };

    await expect(
      result.current.mutateAsync({
        customer_type: 'individual',
        email: 'DavidChimezie2018@gmail.com',
        first_name: 'David',
        last_name: 'Chimezie',
        phone: '08062712682',
      })
    ).rejects.toThrow('Customer with this email or phone already exists');
  });
});
