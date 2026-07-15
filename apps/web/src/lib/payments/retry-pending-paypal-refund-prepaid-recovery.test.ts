import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '@/lib/logger';
import { restorePendingPaypalRefundPrepaidTender } from './restore-pending-paypal-refund-prepaid-tender';
import { retryPendingPaypalRefundPrepaidRecovery } from './retry-pending-paypal-refund-prepaid-recovery';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock('./restore-pending-paypal-refund-prepaid-tender', () => ({
  restorePendingPaypalRefundPrepaidTender: vi.fn(),
}));

function buildSupabase(touchError: unknown = null) {
  const updates: Record<string, unknown>[] = [];
  const builder = {
    update: vi.fn((payload: Record<string, unknown>) => {
      updates.push(payload);
      return builder;
    }),
    eq: vi.fn(() => builder),
    // biome-ignore lint/suspicious/noThenProperty: intentional Supabase query-builder thenable
    then: (
      resolve: (value: unknown) => unknown,
      reject: (reason: unknown) => unknown
    ) => Promise.resolve({ error: touchError }).then(resolve, reject),
  };
  return {
    client: { from: vi.fn(() => builder) } as unknown as SupabaseClient,
    updates,
  };
}

const input = {
  merchantId: 'merchant-1',
  orderId: 'order-1',
  transactionId: 'txn-1',
  transactionMetadata: { paypal_pending_refund_ids: ['REFUND-P'] },
  checkedAt: '2026-07-15T02:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('retryPendingPaypalRefundPrepaidRecovery', () => {
  it('returns true without deferring when prepaid restoration succeeds', async () => {
    vi.mocked(restorePendingPaypalRefundPrepaidTender).mockResolvedValue(true);
    const { client, updates } = buildSupabase();

    await expect(
      retryPendingPaypalRefundPrepaidRecovery(client, input)
    ).resolves.toBe(true);
    expect(updates).toEqual([]);
  });

  it('contains a thrown recovery and defers the refund_pending row', async () => {
    vi.mocked(restorePendingPaypalRefundPrepaidTender).mockRejectedValue(
      new Error('wallet database unavailable')
    );
    const { client, updates } = buildSupabase();

    await expect(
      retryPendingPaypalRefundPrepaidRecovery(client, input)
    ).resolves.toBe(false);
    expect(updates).toEqual([{ updated_at: input.checkedAt }]);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ transactionId: 'txn-1' })
    );
  });

  it('logs a failed refund_pending retry timestamp update', async () => {
    vi.mocked(restorePendingPaypalRefundPrepaidTender).mockResolvedValue(false);
    const { client } = buildSupabase({ message: 'touch failed' });

    await expect(
      retryPendingPaypalRefundPrepaidRecovery(client, input)
    ).resolves.toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('failed to defer'),
        transactionId: 'txn-1',
      })
    );
  });
});
