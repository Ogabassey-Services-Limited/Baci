import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '@/lib/logger';
import { filePaypalCapturePersistFailureReview } from './file-paypal-capture-persist-failure-review';

vi.mock('server-only', () => ({}));

const insertMock = vi.hoisted(() => vi.fn());
// The 23505 path reads the existing row back and appends the new occurrence to
// it, so the mock has to support select/update as well as insert.
const existingRowMock = vi.hoisted(() =>
  vi.fn(() => ({ data: null, error: null }) as Record<string, unknown>)
);
const updateMock = vi.hoisted(() =>
  vi.fn((_payload: Record<string, unknown>) => ({ error: null }))
);
const isFilterMock = vi.hoisted(() =>
  vi.fn((_column: string, _value: unknown) => undefined)
);

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table !== 'reconciliation_review') {
        throw new Error(`Unexpected table: ${table}`);
      }
      const builder: Record<string, unknown> = {
        insert: insertMock,
        select: () => builder,
        eq: () => builder,
        // The readback must filter on the partial unique index's predicate
        // (`resolved_at IS NULL`), so the mock has to support `.is()`.
        is: (column: string, value: unknown) => {
          isFilterMock(column, value);
          return builder;
        },
        maybeSingle: () => Promise.resolve(existingRowMock()),
        update: (payload: Record<string, unknown>) => {
          updateMock(payload);
          return builder;
        },
      };
      return builder;
    }),
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const baseArgs = {
  gatewayReference: 'PP-ORD-1',
  merchantId: 'merchant-1',
  orderId: 'order-1',
  reason: 'PayPal capture completed but transaction status update failed',
  transactionId: 'txn-1',
};

describe('filePaypalCapturePersistFailureReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertMock.mockReset();
    insertMock.mockResolvedValue({ error: null });
  });

  it('files a paypal_capture_persist_failed reconciliation row', async () => {
    await filePaypalCapturePersistFailureReview({
      ...baseArgs,
      metadata: { stage: 'transaction_update' },
    });

    expect(insertMock).toHaveBeenCalledWith({
      candidates: null,
      issue_type: 'paypal_capture_persist_failed',
      merchant_id: 'merchant-1',
      order_id: 'order-1',
      paystack_ref: 'PP-ORD-1',
      reason: baseArgs.reason,
      txn_id: 'txn-1',
      metadata: { stage: 'transaction_update' },
    });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          'PayPal capture succeeded but DB persist failed; filing reconciliation review',
        orderId: 'order-1',
      })
    );
  });

  it('defaults metadata to an empty object', async () => {
    await filePaypalCapturePersistFailureReview(baseArgs);

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: {} })
    );
  });

  it('appends a DISTINCT later problem to the order’s open review instead of dropping it (Codex pass-10 P2)', async () => {
    // The unique index is (issue_type, order_id), but this helper files many
    // different problems for the same order (duplicate capture, then a refund that
    // failed…). Treating every 23505 as a retry no-op silently shrank the ops
    // queue to the first event.
    insertMock.mockResolvedValue({ error: { code: '23505' } });
    existingRowMock.mockReturnValue({
      data: {
        id: 'review-1',
        metadata: { stage: 'captured_after_settlement' },
      },
      error: null,
    });

    await expect(
      filePaypalCapturePersistFailureReview({
        ...baseArgs,
        reason: 'Refund of the duplicate capture failed',
        metadata: { stage: 'duplicate_refund_failed' },
      })
    ).resolves.toBeUndefined();

    const payload = updateMock.mock.calls[0][0] as unknown as {
      reason: string;
      metadata: { occurrences: Record<string, unknown>[] };
    };
    // The 23505 comes from a PARTIAL unique index (`WHERE resolved_at IS NULL`),
    // so the readback must carry the same predicate — otherwise a resolved
    // historical row joins the result, maybeSingle() errors, and the new
    // occurrence is dropped exactly on the orders with the most history.
    expect(isFilterMock).toHaveBeenCalledWith('resolved_at', null);

    expect(payload.reason).toBe('Refund of the duplicate capture failed');
    expect(payload.metadata.occurrences).toHaveLength(1);
    expect(payload.metadata.occurrences[0]).toMatchObject({
      stage: 'duplicate_refund_failed',
      txn_id: 'txn-1',
    });
    // The original problem is preserved alongside the new one.
    expect(payload.metadata).toMatchObject({
      stage: 'captured_after_settlement',
    });
  });

  it('logs when a conflicting review row cannot be read back to append to', async () => {
    insertMock.mockResolvedValue({ error: { code: '23505' } });
    existingRowMock.mockReturnValue({ data: null, error: null });

    await expect(
      filePaypalCapturePersistFailureReview(baseArgs)
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          'PayPal review row conflicted but could not be read back to append the new occurrence',
      })
    );
  });

  it('logs a non-duplicate insert error without blocking', async () => {
    insertMock.mockResolvedValue({
      error: { code: 'XX000', message: 'db unavailable' },
    });

    await expect(
      filePaypalCapturePersistFailureReview(baseArgs)
    ).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Failed to file PayPal capture-persist reconciliation review',
      })
    );
  });

  it('swallows a thrown insert failure', async () => {
    insertMock.mockRejectedValue(new Error('network'));

    await expect(
      filePaypalCapturePersistFailureReview(baseArgs)
    ).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          'Failed to file PayPal capture-persist reconciliation review (threw)',
      })
    );
  });
});
