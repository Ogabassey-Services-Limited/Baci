import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryClientMock = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
}));

const supabaseMock = vi.hoisted(() => {
  type RpcResult = {
    error: { message: string } | null;
  };

  let rpcResult: RpcResult = { error: null };

  return {
    reset: () => {
      rpcResult = { error: null };
    },
    rpc: vi.fn(() => Promise.resolve(rpcResult)),
    setRpcResult: (result: RpcResult) => {
      rpcResult = result;
    },
  };
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: supabaseMock.rpc,
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

type UpdateTransactionReviewDetailsInput = {
  costPrice: number;
  orderId: string;
  productId: string;
  supplierName: string;
  transactionDateIso: string;
};

type TransactionReviewMutation = {
  mutationFn: (input: UpdateTransactionReviewDetailsInput) => Promise<void>;
  onSuccess: () => void;
};

function getMutation() {
  return useUpdateTransactionCostPrice() as unknown as TransactionReviewMutation;
}

function makeInput(
  overrides: Partial<UpdateTransactionReviewDetailsInput> = {}
) {
  return {
    costPrice: 125_000,
    orderId: 'order-1',
    productId: 'product-1',
    supplierName: 'Main Supplier',
    transactionDateIso: '2026-05-12T12:30:15.250Z',
    ...overrides,
  };
}

describe('useUpdateTransactionCostPrice', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    supabaseMock.reset();
  });

  it('saves cost price, supplier, and transaction date through one atomic RPC', async () => {
    const mutation = getMutation();

    await mutation.mutationFn(makeInput());

    expect(supabaseMock.rpc).toHaveBeenCalledTimes(1);
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      'update_transaction_review_details',
      {
        p_cost_price: 125_000,
        p_client_timezone: expect.any(String),
        p_merchant_id: 'merchant-1',
        p_order_id: 'order-1',
        p_product_id: 'product-1',
        p_supplier_name: 'Main Supplier',
        p_transaction_date: '2026-05-12T12:30:15.250Z',
      }
    );

    mutation.onSuccess();

    expect(queryClientMock.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['transaction-review'],
    });
    expect(queryClientMock.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['products'],
    });
  });

  it('allows today by calendar day even when the timestamp is later than now', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-12T10:00:00.000Z'));
    const mutation = getMutation();

    await expect(
      mutation.mutationFn(
        makeInput({ transactionDateIso: '2026-05-12T18:30:00.000Z' })
      )
    ).resolves.toBeUndefined();

    expect(supabaseMock.rpc).toHaveBeenCalledTimes(1);
  });

  it('uses the local calendar day instead of the UTC date key', async () => {
    const previousTimeZone = process.env.TZ;
    process.env.TZ = 'Africa/Lagos';
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-12T23:30:00.000Z'));
    const mutation = getMutation();

    try {
      await expect(
        mutation.mutationFn(
          makeInput({ transactionDateIso: '2026-05-13T00:00:00.000Z' })
        )
      ).resolves.toBeUndefined();
    } finally {
      if (previousTimeZone === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = previousTimeZone;
      }
    }

    expect(supabaseMock.rpc).toHaveBeenCalledTimes(1);
  });

  it('rejects future transaction calendar days before saving', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-12T10:00:00.000Z'));
    const mutation = getMutation();

    await expect(
      mutation.mutationFn(
        makeInput({ transactionDateIso: '2026-05-13T00:00:00.000Z' })
      )
    ).rejects.toThrow('Transaction date cannot be in the future.');

    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it('rejects invalid cost prices before saving', async () => {
    const mutation = getMutation();

    await expect(
      mutation.mutationFn(makeInput({ costPrice: -1 }))
    ).rejects.toThrow('Cost price must be a non-negative number');

    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it('rejects invalid transaction dates before saving', async () => {
    const mutation = getMutation();

    await expect(
      mutation.mutationFn(makeInput({ transactionDateIso: 'not-a-date' }))
    ).rejects.toThrow('Enter a valid transaction date.');

    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it('rejects missing transaction or product identifiers before saving', async () => {
    const mutation = getMutation();

    await expect(
      mutation.mutationFn(makeInput({ orderId: '   ', productId: '' }))
    ).rejects.toThrow('Transaction and product are required');

    expect(supabaseMock.rpc).not.toHaveBeenCalled();
  });

  it('surfaces RPC save errors', async () => {
    supabaseMock.setRpcResult({
      error: { message: 'Transaction not found for this merchant' },
    });
    const mutation = getMutation();

    await expect(mutation.mutationFn(makeInput())).rejects.toThrow(
      'Transaction not found for this merchant'
    );
  });
});
