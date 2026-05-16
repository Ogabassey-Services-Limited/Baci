import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryClientMock = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
}));

const supabaseMock = vi.hoisted(() => {
  type QueryResult = {
    data: unknown[] | null;
    error: { message: string } | null;
  };

  const calls: Array<{ args: unknown[]; method: string; table: string }> = [];
  const tableResults = new Map<string, QueryResult>();

  function resultFor(table: string): QueryResult {
    return (
      tableResults.get(table) ?? { data: [{ id: `${table}-1` }], error: null }
    );
  }

  function makeChain(table: string) {
    const chain: Record<string, (...args: unknown[]) => unknown> = {};

    const passthrough =
      (method: string) =>
      (...args: unknown[]) => {
        calls.push({ args, method, table });
        return chain;
      };

    for (const method of ['update', 'eq']) {
      chain[method] = passthrough(method);
    }

    chain.select = (...args: unknown[]) => {
      calls.push({ args, method: 'select', table });
      return Promise.resolve(resultFor(table));
    };

    return chain;
  }

  return {
    calls,
    from: vi.fn((table: string) => makeChain(table)),
    reset: () => {
      calls.length = 0;
      tableResults.clear();
    },
    setTableResult: (table: string, result: QueryResult) => {
      tableResults.set(table, result);
    },
  };
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: supabaseMock.from,
  },
}));

vi.mock('./useMerchant', () => ({
  useMerchant: () => ({ merchant: { id: 'merchant-1' } }),
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>(
    '@tanstack/react-query'
  );

  return {
    ...actual,
    useMutation: vi.fn((config) => config),
    useQueryClient: () => queryClientMock,
  };
});

import { useUpdateTransactionCostPrice } from './useUpdateTransactionCostPrice';

describe('useUpdateTransactionCostPrice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMock.reset();
  });

  it('updates cost price, supplier metadata, and transaction date for the merchant', async () => {
    const mutation = useUpdateTransactionCostPrice() as unknown as {
      mutationFn: (input: {
        costPrice: number;
        orderId: string;
        productId: string;
        productMetadata: Record<string, unknown> | null;
        supplierName: string;
        transactionDateIso: string;
      }) => Promise<void>;
      onSuccess: () => void;
    };

    await mutation.mutationFn({
      costPrice: 125_000,
      orderId: 'order-1',
      productId: 'product-1',
      productMetadata: { color: 'black', vendor: 'Old Vendor' },
      supplierName: 'Main Supplier',
      transactionDateIso: '2026-05-12T12:30:15.250Z',
    });

    expect(supabaseMock.calls).toEqual(
      expect.arrayContaining([
        {
          args: [
            {
              cost_price: 125_000,
              metadata: {
                color: 'black',
                supplier_name: 'Main Supplier',
                vendor_name: 'Main Supplier',
              },
              updated_at: expect.any(String),
            },
          ],
          method: 'update',
          table: 'products',
        },
        { args: ['id', 'product-1'], method: 'eq', table: 'products' },
        {
          args: ['merchant_id', 'merchant-1'],
          method: 'eq',
          table: 'products',
        },
        {
          args: [{ transaction_date: '2026-05-12T12:30:15.250Z' }],
          method: 'update',
          table: 'orders',
        },
        { args: ['id', 'order-1'], method: 'eq', table: 'orders' },
        { args: ['merchant_id', 'merchant-1'], method: 'eq', table: 'orders' },
      ])
    );

    mutation.onSuccess();

    expect(queryClientMock.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['transaction-review'],
    });
    expect(queryClientMock.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['products'],
    });
  });

  it('rejects invalid cost prices before updating either table', async () => {
    const mutation = useUpdateTransactionCostPrice() as unknown as {
      mutationFn: (input: {
        costPrice: number;
        orderId: string;
        productId: string;
        productMetadata: Record<string, unknown> | null;
        supplierName: string;
        transactionDateIso: string;
      }) => Promise<void>;
    };

    await expect(
      mutation.mutationFn({
        costPrice: -1,
        orderId: 'order-1',
        productId: 'product-1',
        productMetadata: null,
        supplierName: '',
        transactionDateIso: '2026-05-12T12:30:15.250Z',
      })
    ).rejects.toThrow('Cost price must be a non-negative number');

    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it('surfaces zero-row order updates as a transaction permission error', async () => {
    supabaseMock.setTableResult('orders', { data: [], error: null });
    const mutation = useUpdateTransactionCostPrice() as unknown as {
      mutationFn: (input: {
        costPrice: number;
        orderId: string;
        productId: string;
        productMetadata: Record<string, unknown> | null;
        supplierName: string;
        transactionDateIso: string;
      }) => Promise<void>;
    };

    await expect(
      mutation.mutationFn({
        costPrice: 10,
        orderId: 'order-1',
        productId: 'product-1',
        productMetadata: null,
        supplierName: '',
        transactionDateIso: '2026-05-12T12:30:15.250Z',
      })
    ).rejects.toThrow('Transaction not found for this merchant');
  });

  it('rejects invalid transaction dates before updating either table', async () => {
    const mutation = useUpdateTransactionCostPrice() as unknown as {
      mutationFn: (input: {
        costPrice: number;
        orderId: string;
        productId: string;
        productMetadata: Record<string, unknown> | null;
        supplierName: string;
        transactionDateIso: string;
      }) => Promise<void>;
    };

    await expect(
      mutation.mutationFn({
        costPrice: 10,
        orderId: 'order-1',
        productId: 'product-1',
        productMetadata: null,
        supplierName: '',
        transactionDateIso: 'not-a-date',
      })
    ).rejects.toThrow('Enter a valid transaction date.');

    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it('rejects missing transaction or product identifiers before updating either table', async () => {
    const mutation = useUpdateTransactionCostPrice() as unknown as {
      mutationFn: (input: {
        costPrice: number;
        orderId: string;
        productId: string;
        productMetadata: Record<string, unknown> | null;
        supplierName: string;
        transactionDateIso: string;
      }) => Promise<void>;
    };

    await expect(
      mutation.mutationFn({
        costPrice: 10,
        orderId: '   ',
        productId: '',
        productMetadata: null,
        supplierName: '',
        transactionDateIso: '2026-05-12T12:30:15.250Z',
      })
    ).rejects.toThrow('Transaction and product are required');

    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it('surfaces zero-row product updates as a product permission error', async () => {
    supabaseMock.setTableResult('products', { data: [], error: null });
    const mutation = useUpdateTransactionCostPrice() as unknown as {
      mutationFn: (input: {
        costPrice: number;
        orderId: string;
        productId: string;
        productMetadata: Record<string, unknown> | null;
        supplierName: string;
        transactionDateIso: string;
      }) => Promise<void>;
    };

    await expect(
      mutation.mutationFn({
        costPrice: 10,
        orderId: 'order-1',
        productId: 'product-1',
        productMetadata: null,
        supplierName: '',
        transactionDateIso: '2026-05-12T12:30:15.250Z',
      })
    ).rejects.toThrow('Product not found for this merchant');
  });
});
