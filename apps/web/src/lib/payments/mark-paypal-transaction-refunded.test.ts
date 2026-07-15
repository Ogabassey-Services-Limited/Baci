import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '@/lib/logger';
import { createServiceClient } from '@/lib/supabase/service';
import { markPaypalTransactionRefunded } from './mark-paypal-transaction-refunded';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}));

const TXN_ID = '123e4567-e89b-12d3-a456-426614174111';
const rpc = vi.fn();
const client = { rpc } as unknown as SupabaseClient;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createServiceClient).mockReturnValue(client as never);
  rpc.mockResolvedValue({ data: true, error: null });
});

describe('markPaypalTransactionRefunded', () => {
  it('uses the atomic RPC to terminalize a completed refund', async () => {
    const failed = await markPaypalTransactionRefunded(
      undefined,
      TXN_ID,
      'duplicate capture'
    );

    expect(rpc).toHaveBeenCalledWith('mark_paypal_transaction_refunded', {
      p_pending_refund_ids: [],
      p_restore_prepaid_on_reconcile: false,
      p_status: 'refunded',
      p_transaction_id: TXN_ID,
    });
    expect(failed).toBe(false);
  });

  it('atomically supplies pending refund metadata with refund_pending', async () => {
    const failed = await markPaypalTransactionRefunded(
      undefined,
      TXN_ID,
      'cancellation refund pending',
      {
        pending: true,
        pendingRefundIds: ['REFUND-P'],
        restorePrepaidOnReconcile: true,
      }
    );

    expect(rpc).toHaveBeenCalledWith('mark_paypal_transaction_refunded', {
      p_pending_refund_ids: ['REFUND-P'],
      p_restore_prepaid_on_reconcile: true,
      p_status: 'refund_pending',
      p_transaction_id: TXN_ID,
    });
    expect(failed).toBe(false);
  });

  it('treats zero affected rows as an audit failure', async () => {
    rpc.mockResolvedValue({ data: false, error: null });

    await expect(
      markPaypalTransactionRefunded(undefined, TXN_ID, 'duplicate capture')
    ).resolves.toBe(true);

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ transactionId: TXN_ID })
    );
  });

  it('logs but does not throw when the atomic RPC fails', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });

    await expect(
      markPaypalTransactionRefunded(undefined, TXN_ID, 'duplicate capture')
    ).resolves.toBe(true);

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ transactionId: TXN_ID })
    );
  });

  it('swallows a thrown client error rather than discarding the successful refund', async () => {
    rpc.mockRejectedValue(new Error('connection reset'));

    await expect(
      markPaypalTransactionRefunded(undefined, TXN_ID, 'mode mismatch')
    ).resolves.toBe(true);

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ transactionId: TXN_ID })
    );
  });
});
