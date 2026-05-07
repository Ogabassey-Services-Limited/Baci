import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fulfillPendingVtuTransactionMock } = vi.hoisted(() => ({
  fulfillPendingVtuTransactionMock: vi.fn(),
}));

vi.mock('@/lib/vtu-fulfillment', () => ({
  fulfillPendingVtuTransaction: fulfillPendingVtuTransactionMock,
}));

import { reconcileProcessingVtuTransactions } from '@/lib/vtu-processing-reconciliation';

function createProcessingQuery({
  data,
  error = null,
}: {
  data: unknown;
  error?: unknown;
}) {
  const query = {
    eq: vi.fn(() => query),
    gte: vi.fn(() => query),
    in: vi.fn(() => query),
    limit: vi.fn(async () => ({ data, error })),
    lte: vi.fn(() => query),
    order: vi.fn(() => query),
    select: vi.fn(() => query),
  };
  return query;
}

function createSupabase(query: ReturnType<typeof createProcessingQuery>) {
  return {
    from: vi.fn(() => query),
  };
}

describe('reconcileProcessingVtuTransactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reconciles recent processing bill transactions and summarizes outcomes', async () => {
    const query = createProcessingQuery({
      data: [{ id: 'tx-success' }, { id: 'tx-processing' }],
    });
    const supabase = createSupabase(query);
    fulfillPendingVtuTransactionMock
      .mockResolvedValueOnce({ status: 'successful' })
      .mockResolvedValueOnce({ status: 'processing' });

    const result = await reconcileProcessingVtuTransactions({
      limit: 2,
      now: new Date('2026-05-07T21:15:00.000Z'),
      supabase: supabase as never,
    });

    expect(supabase.from).toHaveBeenCalledWith('vtu_transactions');
    expect(query.select).toHaveBeenCalledWith(
      'id, request_reference, transaction_id, type, created_at, updated_at'
    );
    expect(query.eq).toHaveBeenCalledWith('status', 'processing');
    expect(query.in).toHaveBeenCalledWith('type', [
      'electricity',
      'cable_tv',
      'betting',
    ]);
    expect(query.lte).toHaveBeenCalledWith(
      'created_at',
      '2026-05-07T21:14:15.000Z'
    );
    expect(query.gte).toHaveBeenCalledWith(
      'created_at',
      '2026-05-06T21:15:00.000Z'
    );
    expect(query.order).toHaveBeenCalledWith('created_at', {
      ascending: true,
    });
    expect(query.limit).toHaveBeenCalledWith(2);
    expect(fulfillPendingVtuTransactionMock).toHaveBeenNthCalledWith(1, {
      supabase,
      transactionId: 'tx-success',
    });
    expect(fulfillPendingVtuTransactionMock).toHaveBeenNthCalledWith(2, {
      supabase,
      transactionId: 'tx-processing',
    });
    expect(result).toEqual({
      checked: 2,
      errored: 0,
      errors: [],
      failed: 0,
      processing: 1,
      successful: 1,
    });
  });

  it('continues reconciling after one transaction throws', async () => {
    const query = createProcessingQuery({
      data: [{ id: 'tx-error' }, { id: 'tx-failed' }],
    });
    const supabase = createSupabase(query);
    fulfillPendingVtuTransactionMock
      .mockRejectedValueOnce(new Error('Kuda TSQ unavailable'))
      .mockResolvedValueOnce({ status: 'failed' });

    const result = await reconcileProcessingVtuTransactions({
      supabase: supabase as never,
    });

    expect(result).toEqual({
      checked: 2,
      errored: 1,
      errors: [
        {
          message: 'Kuda TSQ unavailable',
          transactionId: 'tx-error',
        },
      ],
      failed: 1,
      processing: 0,
      successful: 0,
    });
  });

  it('throws when processing transaction lookup fails', async () => {
    const query = createProcessingQuery({
      data: null,
      error: { message: 'database timeout' },
    });
    const supabase = createSupabase(query);

    await expect(
      reconcileProcessingVtuTransactions({ supabase: supabase as never })
    ).rejects.toThrow(
      'Failed to fetch processing VTU transactions: database timeout'
    );
  });
});
