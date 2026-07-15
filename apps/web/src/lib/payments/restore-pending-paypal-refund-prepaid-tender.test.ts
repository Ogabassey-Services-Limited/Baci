import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { restorePrepaidTender } from './refund-paypal-prepaid';
import { resolvePaypalSplit } from './resolve-paypal-split';
import { restorePendingPaypalRefundPrepaidTender } from './restore-pending-paypal-refund-prepaid-tender';

vi.mock('server-only', () => ({}));

vi.mock('./resolve-paypal-split', () => ({
  resolvePaypalSplit: vi.fn(),
}));

vi.mock('./refund-paypal-prepaid', () => ({
  restorePrepaidTender: vi.fn(),
}));

const supabase = {} as SupabaseClient;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('restorePendingPaypalRefundPrepaidTender', () => {
  it('retries the idempotent prepaid restoration for a completed pending refund', async () => {
    vi.mocked(resolvePaypalSplit).mockResolvedValue({
      paypalResidualPaid: 5000,
      prepaidPaid: 15000,
      savingsAmountUsed: 3000,
      customerId: 'customer-1',
    });
    vi.mocked(restorePrepaidTender).mockResolvedValue({
      restored: 15000,
      walletCreditId: 'wallet-refund-1',
      savingsRestored: true,
    });

    const restored = await restorePendingPaypalRefundPrepaidTender(supabase, {
      merchantId: 'merchant-1',
      orderId: 'order-1',
      transactionMetadata: { paypal_split: { prepaidPaid: 15000 } },
    });

    expect(restorePrepaidTender).toHaveBeenCalledWith(supabase, {
      merchantId: 'merchant-1',
      orderId: 'order-1',
      customerId: 'customer-1',
      prepaidPaid: 15000,
      savingsAmountUsed: 3000,
      reason: 'PayPal cancellation refund reconciliation',
    });
    expect(restored).toBe(true);
  });

  it('fails closed when the original payment split cannot be resolved', async () => {
    vi.mocked(resolvePaypalSplit).mockResolvedValue({
      failed: true,
      reason: 'order_lookup_failed',
    });

    await expect(
      restorePendingPaypalRefundPrepaidTender(supabase, {
        merchantId: 'merchant-1',
        orderId: 'order-1',
        transactionMetadata: {},
      })
    ).resolves.toBe(false);
    expect(restorePrepaidTender).not.toHaveBeenCalled();
  });

  it('keeps retrying until both wallet credit and savings audit are restored', async () => {
    vi.mocked(resolvePaypalSplit).mockResolvedValue({
      paypalResidualPaid: 5000,
      prepaidPaid: 15000,
      savingsAmountUsed: 3000,
      customerId: 'customer-1',
    });
    vi.mocked(restorePrepaidTender).mockResolvedValue({
      restored: 15000,
      savingsRestored: false,
    });

    await expect(
      restorePendingPaypalRefundPrepaidTender(supabase, {
        merchantId: 'merchant-1',
        orderId: 'order-1',
        transactionMetadata: {},
      })
    ).resolves.toBe(false);
  });
});
