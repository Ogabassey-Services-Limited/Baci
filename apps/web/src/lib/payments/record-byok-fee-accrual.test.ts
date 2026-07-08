import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '@/lib/logger';
import { recordByokFeeAccrual } from './record-byok-fee-accrual';

vi.mock('server-only', () => ({}));

const insertMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table !== 'byok_fee_accruals') {
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
  merchantId: 'merchant-1',
  orderId: 'order-1',
  transactionReference: 'PP-ORD-1',
  provider: 'paypal',
  currency: 'USD',
  orderAmount: 100,
};

describe('recordByokFeeAccrual', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertMock.mockReset();
    insertMock.mockResolvedValue({ error: null });
  });

  it('writes a waived, zero-fee accrual row', async () => {
    await recordByokFeeAccrual(baseArgs);

    expect(insertMock).toHaveBeenCalledWith({
      merchant_id: 'merchant-1',
      order_id: 'order-1',
      transaction_reference: 'PP-ORD-1',
      provider: 'paypal',
      currency: 'USD',
      order_amount: 100,
      fee_amount: 0,
      waived: true,
    });
  });

  it('logs, but does not throw, when the insert errors', async () => {
    insertMock.mockResolvedValue({ error: { message: 'db down' } });

    await expect(recordByokFeeAccrual(baseArgs)).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Failed to record BYOK fee accrual' })
    );
  });

  it('swallows a thrown insert failure', async () => {
    insertMock.mockRejectedValue(new Error('network'));

    await expect(recordByokFeeAccrual(baseArgs)).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Failed to record BYOK fee accrual (threw)',
      })
    );
  });
});
