import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => {
  type QueryResult = {
    data: unknown;
    error: { message: string } | null;
  };
  const chains: Array<{
    calls: Array<{ args: unknown[]; method: string }>;
    table: string;
  }> = [];
  let orderDetailResult: QueryResult = {
    data: {
      id: 'order-1',
      recorded_by_user_id: null,
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
    const calls: Array<{ args: unknown[]; method: string }> = [];

    chains.push({ table, calls });

    const passthrough =
      (method: string) =>
      (...args: unknown[]) => {
        calls.push({ method, args });
        return chain;
      };

    for (const method of [
      'select',
      'eq',
      'in',
      'gte',
      'lte',
      'order',
      'range',
    ]) {
      chain[method] = passthrough(method);
    }

    chain.single = () =>
      Promise.resolve(table === 'orders' ? orderDetailResult : getTableResult(table));
    chain.maybeSingle = () => Promise.resolve(getTableResult(table));
    chain.then = (resolve) => Promise.resolve(getTableResult(table)).then(resolve);

    return chain;
  }

  return {
    chains,
    from: vi.fn((table: string) => makeChain(table)),
    reset: () => {
      chains.length = 0;
      tableResults.clear();
      orderDetailResult = {
        data: {
          id: 'order-1',
          recorded_by_user_id: null,
          total: 100,
          wallet_amount_used: 0,
        },
        error: null,
      };
    },
    setOrderDetailResult: (nextResult: QueryResult) => {
      orderDetailResult = nextResult;
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

import { fetchOrderById, useOrder } from './useOrderDetails';

describe('fetchOrderById', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMock.reset();
  });

  it('applies branch scope when fetching a single order by id', async () => {
    await fetchOrderById('order-1', 'merchant-1', {
      type: 'branch',
      branchId: 'branch-1',
    });

    const orderQuery = supabaseMock.chains.find(
      (chain) => chain.table === 'orders'
    );

    expect(orderQuery?.calls).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['id', 'order-1'] },
        { method: 'eq', args: ['merchant_id', 'merchant-1'] },
        { method: 'eq', args: ['branch_id', 'branch-1'] },
      ])
    );
  });

  it('returns calculated payment metadata and mapped order items', async () => {
    supabaseMock.setOrderDetailResult({
      data: {
        id: 'order-1',
        recorded_by_user_id: null,
        total: 100,
        wallet_amount_used: 20,
      },
      error: null,
    });
    supabaseMock.setTableResult('order_items', {
      data: [
        {
          id: 'item-1',
          has_assurance: true,
          product_id: 'product-1',
          variant_name: 'Blue',
          name: null,
          quantity: 2,
          price: 25,
          products: {
            condition: 'new',
            images: ['https://example.test/image.jpg'],
            name: 'Phone',
          },
        },
      ],
      error: null,
    });
    supabaseMock.setTableResult('transactions', {
      data: [{ amount: 15 }],
      error: null,
    });
    supabaseMock.setTableResult('order_payment_accounts', {
      data: {
        account_name: 'Baci Store',
        account_number: '1234567890',
        bank_name: 'Paystack-Titan',
      },
      error: null,
    });

    await expect(fetchOrderById('order-1', 'merchant-1')).resolves.toEqual(
      expect.objectContaining({
        amount_paid: 35,
        balance: 65,
        virtual_account: {
          account_name: 'Baci Store',
          account_number: '1234567890',
          bank_name: 'Paystack-Titan',
        },
        items: [
          expect.objectContaining({
            id: 'item-1',
            condition: 'new',
            image_url: 'https://example.test/image.jpg',
            name: 'Phone',
            product_name: 'Phone',
            quantity: 2,
            variant_name: 'Blue',
          }),
        ],
      })
    );
  });

  it('throws order query errors before running child queries', async () => {
    supabaseMock.setOrderDetailResult({
      data: null,
      error: { message: 'Order unavailable' },
    });

    await expect(fetchOrderById('order-1', 'merchant-1')).rejects.toThrow(
      'Order unavailable'
    );
    expect(supabaseMock.chains.map((chain) => chain.table)).toEqual(['orders']);
  });

  it('throws child query errors from the parallel detail fetch', async () => {
    supabaseMock.setTableResult('order_items', {
      data: [],
      error: { message: 'Items unavailable' },
    });

    await expect(fetchOrderById('order-1', 'merchant-1')).rejects.toThrow(
      'Items unavailable'
    );
  });

  it('configures useOrder with merchant and branch-scope cache keys', async () => {
    const query = useOrder('order-1') as unknown as {
      enabled: boolean;
      queryFn: () => Promise<unknown>;
      queryKey: unknown[];
    };

    expect(queryMock.useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        queryKey: ['order', 'order-1', 'merchant-1', 'all'],
      })
    );

    await query.queryFn();

    const orderQuery = supabaseMock.chains.find(
      (chain) => chain.table === 'orders'
    );

    expect(orderQuery?.calls).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['id', 'order-1'] },
        { method: 'eq', args: ['merchant_id', 'merchant-1'] },
      ])
    );
  });
});
