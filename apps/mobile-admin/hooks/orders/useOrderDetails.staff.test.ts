import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => {
  type QueryResult = {
    data: unknown;
    error: { message: string } | null;
  };
  let orderDetailResult: QueryResult = {
    data: {
      id: 'order-1',
      recorded_by_user_id: 'user-1',
      total: 100,
      wallet_amount_used: 0,
    },
    error: null,
  };
  const tableResults = new Map<string, QueryResult>();

  function getTableResult(table: string): QueryResult {
    return tableResults.get(table) ?? { data: [], error: null };
  }

  function makeChain(table: string) {
    const chain: Record<string, (...args: unknown[]) => unknown> & {
      maybeSingle?: () => Promise<QueryResult>;
      single?: () => Promise<QueryResult>;
      then?: (resolve: (value: QueryResult) => unknown) => Promise<unknown>;
    } = {};
    const passthrough = () => () => chain;

    for (const method of ['select', 'eq', 'in']) {
      chain[method] = passthrough();
    }

    chain.single = () =>
      Promise.resolve(
        table === 'orders' ? orderDetailResult : getTableResult(table)
      );
    chain.maybeSingle = () =>
      Promise.resolve(tableResults.get(table) ?? { data: null, error: null });
    chain.then = (resolve) =>
      Promise.resolve(getTableResult(table)).then(resolve);

    return chain;
  }

  return {
    from: vi.fn((table: string) => makeChain(table)),
    reset: () => {
      tableResults.clear();
      orderDetailResult = {
        data: {
          id: 'order-1',
          recorded_by_user_id: 'user-1',
          total: 100,
          wallet_amount_used: 0,
        },
        error: null,
      };
    },
    setTableResult: (table: string, nextResult: QueryResult) => {
      tableResults.set(table, nextResult);
    },
  };
});

const queryMock = vi.hoisted(() => ({
  useQuery: vi.fn((config) => config),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: supabaseMock.from,
  },
}));

vi.mock('@/lib/orders', () => ({
  ORDER_COLUMNS: 'id, merchant_id',
}));

vi.mock('@/lib/supabase-utils', () => ({
  getJoinedRecord: (record: unknown) =>
    Array.isArray(record) ? record[0] : record,
}));

vi.mock('@/schemas/branch', () => ({
  ALL_BRANCH_SCOPE: { type: 'all' },
}));

vi.mock('../useBranchScope', () => ({
  useBranchScope: () => ({ scope: { type: 'all' } }),
}));

vi.mock('../useMerchant', () => ({
  useMerchant: () => ({ merchant: { id: 'merchant-1' } }),
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>(
    '@tanstack/react-query'
  );

  return {
    ...actual,
    useQuery: queryMock.useQuery,
  };
});

import { fetchOrderById } from './useOrderDetails';

describe('fetchOrderById staff metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMock.reset();
  });

  it('resolves staff-created order metadata when staff records exist', async () => {
    supabaseMock.setTableResult('profiles', {
      data: { display_name: 'Ada Merchant', full_name: null },
      error: null,
    });
    supabaseMock.setTableResult('staff_members', {
      data: { id: 'staff-1' },
      error: null,
    });
    supabaseMock.setTableResult('virtual_terminals', {
      data: {
        account_name: 'Ada Terminal',
        account_number: '1234567890',
        bank: 'Kuda',
      },
      error: null,
    });

    await expect(fetchOrderById('order-1', 'merchant-1')).resolves.toEqual(
      expect.objectContaining({
        recorded_by_name: 'Ada',
        staff_terminal: {
          account_name: 'Ada Terminal',
          account_number: '1234567890',
          bank_name: 'Kuda',
        },
      })
    );
  });

  it('does not fail when optional staff metadata records are absent', async () => {
    await expect(fetchOrderById('order-1', 'merchant-1')).resolves.toEqual(
      expect.objectContaining({
        recorded_by_name: null,
        staff_terminal: null,
      })
    );
  });

  it('logs profile lookup errors but still resolves the order', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      // Silence expected log-and-skip auxiliary lookup errors.
    });

    try {
      supabaseMock.setTableResult('profiles', {
        data: null,
        error: { message: 'Profile lookup failed' },
      });

      await expect(fetchOrderById('order-1', 'merchant-1')).resolves.toEqual(
        expect.objectContaining({ recorded_by_name: null })
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'useOrderDetails profiles lookup error:',
        expect.objectContaining({ message: 'Profile lookup failed' })
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('logs staff member lookup errors but still resolves the order', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      // Silence expected log-and-skip auxiliary lookup errors.
    });

    try {
      supabaseMock.setTableResult('staff_members', {
        data: null,
        error: { message: 'Staff lookup failed' },
      });

      await expect(fetchOrderById('order-1', 'merchant-1')).resolves.toEqual(
        expect.objectContaining({ staff_terminal: null })
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'useOrderDetails staff_members lookup error:',
        expect.objectContaining({ message: 'Staff lookup failed' })
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('logs terminal lookup errors but still resolves the order', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      // Silence expected log-and-skip auxiliary lookup errors.
    });

    try {
      supabaseMock.setTableResult('staff_members', {
        data: { id: 'staff-1' },
        error: null,
      });
      supabaseMock.setTableResult('virtual_terminals', {
        data: null,
        error: { message: 'Terminal lookup failed' },
      });

      await expect(fetchOrderById('order-1', 'merchant-1')).resolves.toEqual(
        expect.objectContaining({ staff_terminal: null })
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'useOrderDetails virtual_terminals lookup error:',
        expect.objectContaining({ message: 'Terminal lookup failed' })
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
