import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '@/lib/logger';
import { filePaypalCapturePersistFailureReview } from './file-paypal-capture-persist-failure-review';

vi.mock('server-only', () => ({}));

const insertMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table !== 'reconciliation_review') {
        throw new Error(`Unexpected table: ${table}`);
      }
      return { insert: insertMock };
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

  it('treats a duplicate open review as a no-op', async () => {
    insertMock.mockResolvedValue({ error: { code: '23505' } });

    await expect(
      filePaypalCapturePersistFailureReview(baseArgs)
    ).resolves.toBeUndefined();
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          'paypal_capture_persist_failed reconciliation already filed (expected retry no-op)',
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
