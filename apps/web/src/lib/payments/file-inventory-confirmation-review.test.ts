import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '@/lib/logger';
import { fileInventoryConfirmationFailureReview } from './file-inventory-confirmation-review';

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
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('fileInventoryConfirmationFailureReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertMock.mockReset();
    insertMock.mockResolvedValue({ error: null });
  });

  it('files a serialized inventory reconciliation review row', async () => {
    await fileInventoryConfirmationFailureReview({
      gatewayReference: 'jw-ref-1',
      merchantId: 'merchant-1',
      metadata: { gateway: 'juicyway' },
      orderId: 'order-1',
      reason: 'Inventory confirmation failed',
      transactionId: 'txn-1',
    });

    expect(insertMock).toHaveBeenCalledWith({
      candidates: null,
      issue_type: 'serialized_inventory_confirmation_failed',
      merchant_id: 'merchant-1',
      metadata: { gateway: 'juicyway' },
      order_id: 'order-1',
      paystack_ref: 'jw-ref-1',
      reason: 'Inventory confirmation failed',
      txn_id: 'txn-1',
    });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          'Paid-order inventory confirmation failed; filing reconciliation review',
        orderId: 'order-1',
      })
    );
  });

  it('treats duplicate open reviews as a no-op', async () => {
    insertMock.mockResolvedValue({ error: { code: '23505' } });

    await expect(
      fileInventoryConfirmationFailureReview({
        gatewayReference: 'jw-ref-1',
        merchantId: 'merchant-1',
        orderId: 'order-1',
        reason: 'Inventory confirmation failed',
        transactionId: 'txn-1',
      })
    ).resolves.toBeUndefined();
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          'serialized_inventory_confirmation_failed reconciliation already filed (expected retry no-op)',
        orderId: 'order-1',
      })
    );
  });

  it('logs insert errors without blocking the caller', async () => {
    insertMock.mockResolvedValue({
      error: { code: 'XX000', message: 'database unavailable' },
    });

    await expect(
      fileInventoryConfirmationFailureReview({
        gatewayReference: 'jw-ref-1',
        merchantId: 'merchant-1',
        orderId: 'order-1',
        reason: 'Inventory confirmation failed',
        transactionId: 'txn-1',
      })
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Failed to file serialized inventory reconciliation review',
        orderId: 'order-1',
      })
    );
  });

  it('logs thrown insert failures without blocking the caller', async () => {
    const thrown = new Error('network timeout');
    insertMock.mockRejectedValue(thrown);

    await expect(
      fileInventoryConfirmationFailureReview({
        gatewayReference: 'jw-ref-1',
        merchantId: 'merchant-1',
        orderId: 'order-1',
        reason: 'Inventory confirmation failed',
        transactionId: 'txn-1',
      })
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error: thrown,
        message:
          'Failed to file serialized inventory reconciliation review (threw)',
        orderId: 'order-1',
      })
    );
  });
});
