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

  function getFilteredTableResult(
    table: string,
    calls: Array<{ args: unknown[]; method: string }>
  ): QueryResult {
    const result = getTableResult(table);
    if (table !== 'transactions' || !Array.isArray(result.data)) return result;

    const transactionType = calls.find(
      (call) => call.method === 'eq' && call.args[0] === 'transaction_type'
    )?.args[1];
    if (typeof transactionType !== 'string') return result;

    return {
      ...result,
      data: result.data.filter(
        (row) =>
          typeof row === 'object' &&
          row !== null &&
          'transaction_type' in row &&
          row.transaction_type === transactionType
      ),
    };
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
      Promise.resolve(
        table === 'orders' ? orderDetailResult : getTableResult(table)
      );
    chain.maybeSingle = () =>
      Promise.resolve(tableResults.get(table) ?? { data: null, error: null });
    // biome-ignore lint/suspicious/noThenProperty: Mocking a promise chain
    chain.then = (resolve) =>
      Promise.resolve(getFilteredTableResult(table, calls)).then(resolve);

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
          condition: 'open_box',
          has_assurance: true,
          image_url: 'https://example.test/order-snapshot.jpg',
          item_description: 'Battery health 89%',
          product_id: 'product-1',
          product_match_status: 'linked',
          variant_attributes: { color: 'Blue', storage: '512GB' },
          variant_id: 'variant-1',
          variant_name: 'Blue',
          name: null,
          quantity: 2,
          price: 25,
          products: {
            categories: {
              name: 'Smartphones',
              slug: 'smartphones',
            },
            category: 'Smartphones',
            category_id: 'category-1',
            condition: 'new',
            images: ['https://example.test/image.jpg'],
            name: 'Phone',
          },
        },
      ],
      error: null,
    });
    supabaseMock.setTableResult('transactions', {
      data: [{ amount: 15, transaction_type: 'payment' }],
      error: null,
    });
    supabaseMock.setTableResult('order_payment_accounts', {
      data: [
        {
          account_name: 'Legacy Store',
          account_number: '0987654321',
          bank_name: 'Kora Bank',
          provider: 'korapay',
          created_at: '2026-08-24T12:00:00.000Z',
        },
        {
          account_name: 'Baci Store',
          account_number: '1234567890',
          bank_name: 'Paystack-Titan',
          provider: 'paystack',
          created_at: '2026-08-24T11:00:00.000Z',
        },
      ],
      error: null,
    });

    await expect(fetchOrderById('order-1', 'merchant-1')).resolves.toEqual(
      expect.objectContaining({
        amount_paid: 35,
        balance: 65,
        virtual_account: expect.objectContaining({
          account_name: 'Baci Store',
          account_number: '1234567890',
          bank_name: 'Paystack-Titan',
        }),
        items: [
          expect.objectContaining({
            id: 'item-1',
            category: 'Smartphones',
            category_slug: 'smartphones',
            condition: 'open_box',
            details: 'Battery health 89%',
            image_url: 'https://example.test/order-snapshot.jpg',
            name: 'Phone',
            product_name: 'Phone',
            product_match_status: 'linked',
            quantity: 2,
            variant_attributes: { color: 'Blue', storage: '512GB' },
            variant_id: 'variant-1',
            variant_name: 'Blue',
          }),
        ],
      })
    );

    const transactionQuery = supabaseMock.chains.find(
      (chain) => chain.table === 'transactions'
    );
    expect(transactionQuery?.calls).toEqual(
      expect.arrayContaining([
        { method: 'eq', args: ['order_id', 'order-1'] },
        { method: 'eq', args: ['merchant_id', 'merchant-1'] },
        { method: 'eq', args: ['transaction_type', 'payment'] },
        { method: 'in', args: ['status', ['success', 'completed']] },
      ])
    );
  });

  it('selects Paystack deterministically when legacy account rows coexist', async () => {
    supabaseMock.setTableResult('order_payment_accounts', {
      data: [
        {
          account_name: 'Legacy Store',
          account_number: '0987654321',
          bank_name: 'Kora Bank',
          provider: 'korapay',
          created_at: '2026-08-24T12:00:00.000Z',
        },
        {
          account_name: 'Baci Store',
          account_number: '1234567890',
          bank_name: 'Paystack-Titan',
          provider: 'paystack',
          created_at: '2026-08-24T11:00:00.000Z',
        },
      ],
      error: null,
    });

    await expect(fetchOrderById('order-1', 'merchant-1')).resolves.toEqual(
      expect.objectContaining({
        virtual_account: expect.objectContaining({
          account_number: '1234567890',
          provider: 'paystack',
        }),
      })
    );
  });

  it('treats paid orders without ledger rows as fully paid', async () => {
    supabaseMock.setOrderDetailResult({
      data: {
        amount_paid: 0,
        id: 'order-1',
        payment_status: 'paid',
        recorded_by_user_id: null,
        total: 406_000,
        wallet_amount_used: 0,
      },
      error: null,
    });
    supabaseMock.setTableResult('transactions', {
      data: [],
      error: null,
    });

    await expect(fetchOrderById('order-1', 'merchant-1')).resolves.toEqual(
      expect.objectContaining({
        amount_paid: 406_000,
        balance: 0,
      })
    );
  });

  it('treats a stale partially-paid order as paid when its ledger covers the total', async () => {
    supabaseMock.setOrderDetailResult({
      data: {
        amount_paid: 900_000,
        id: 'order-1',
        payment_status: 'partially_paid',
        recorded_by_user_id: null,
        total: 982_000,
        wallet_amount_used: 0,
      },
      error: null,
    });
    supabaseMock.setTableResult('transactions', {
      data: [
        { amount: 654_000, transaction_type: 'payment' },
        { amount: 82_000, transaction_type: 'payment' },
        { amount: 82_000, transaction_type: 'payment' },
        { amount: 82_000, transaction_type: 'payment' },
        { amount: 82_000, transaction_type: 'payment' },
      ],
      error: null,
    });

    await expect(fetchOrderById('order-1', 'merchant-1')).resolves.toEqual(
      expect.objectContaining({
        amount_paid: 982_000,
        balance: 0,
        payment_status: 'paid',
      })
    );
  });

  it('does not promote a cancelled order when reconciliation payments cover the total', async () => {
    supabaseMock.setOrderDetailResult({
      data: {
        amount_paid: 0,
        cancelled_at: '2026-07-12T09:00:00Z',
        id: 'order-1',
        payment_status: 'unpaid',
        recorded_by_user_id: null,
        shipping_status: 'pending',
        total: 500,
        wallet_amount_used: 0,
      },
      error: null,
    });
    supabaseMock.setTableResult('transactions', {
      data: [{ amount: 500, transaction_type: 'payment' }],
      error: null,
    });

    await expect(fetchOrderById('order-1', 'merchant-1')).resolves.toEqual(
      expect.objectContaining({
        amount_paid: 500,
        balance: 0,
        payment_status: 'unpaid',
      })
    );
  });

  it('excludes refund rows when deriving effective payment status', async () => {
    supabaseMock.setOrderDetailResult({
      data: {
        amount_paid: 400,
        id: 'order-1',
        payment_status: 'partially_paid',
        recorded_by_user_id: null,
        total: 800,
        wallet_amount_used: 0,
      },
      error: null,
    });
    supabaseMock.setTableResult('transactions', {
      data: [
        { amount: 400, transaction_type: 'payment' },
        { amount: 400, transaction_type: 'refund' },
      ],
      error: null,
    });

    await expect(fetchOrderById('order-1', 'merchant-1')).resolves.toEqual(
      expect.objectContaining({
        amount_paid: 400,
        balance: 400,
        payment_status: 'partially_paid',
      })
    );
  });

  it('preserves refunded status when historical payments cover the total', async () => {
    supabaseMock.setOrderDetailResult({
      data: {
        amount_paid: 800,
        id: 'order-1',
        payment_status: 'refunded',
        recorded_by_user_id: null,
        total: 800,
        wallet_amount_used: 0,
      },
      error: null,
    });
    supabaseMock.setTableResult('transactions', {
      data: [{ amount: 800, transaction_type: 'payment' }],
      error: null,
    });

    await expect(fetchOrderById('order-1', 'merchant-1')).resolves.toEqual(
      expect.objectContaining({
        amount_paid: 800,
        balance: 0,
        payment_status: 'refunded',
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
        staleTime: 60000,
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
