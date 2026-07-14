import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockNotifyWalletCredited = vi.fn<(...args: unknown[]) => Promise<void>>();
const mockWarn = vi.fn();

vi.mock('@/lib/payments/notify-wallet-credited', () => ({
  notifyWalletCredited: (...args: unknown[]) =>
    mockNotifyWalletCredited(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: (...args: unknown[]) => mockWarn(...args),
  },
}));

import { scheduleWalletFundedCreditNotification } from '@/lib/payments/schedule-wallet-funded-credit-notification';

const baseArgs = {
  currency: 'NGN',
  customerId: 'customer-1',
  gatewayReference: 'PSK_REF_1',
  merchantId: 'merchant-1',
  orderId: '11111111-1111-4111-8111-111111111111',
  transactionId: 'transaction-1',
  transactionMetadata: { transaction_type: 'wallet_topup' },
};

function createClaimingSupabase(claimed = true) {
  const query = {
    eq: vi.fn(() => query),
    is: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({
      data: claimed ? { id: 'transaction-1' } : null,
      error: null,
    })),
    select: vi.fn(() => query),
    update: vi.fn(() => query),
  };
  return { from: vi.fn(() => query) };
}

describe('scheduleWalletFundedCreditNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotifyWalletCredited.mockResolvedValue(undefined);
  });

  it('schedules a merchant-scoped wallet credit push for the funded amount', async () => {
    const tasks: Array<() => Promise<void>> = [];

    await scheduleWalletFundedCreditNotification({
      ...baseArgs,
      fundedAmount: 20_000,
      scheduleAfter: (task) => tasks.push(task),
      supabase: createClaimingSupabase() as never,
    });

    expect(tasks).toHaveLength(1);
    await tasks[0]?.();
    expect(mockNotifyWalletCredited).toHaveBeenCalledWith({
      amount: 20_000,
      currency: 'NGN',
      customerId: 'customer-1',
      merchantId: 'merchant-1',
      returnTo: '/orders/11111111-1111-4111-8111-111111111111',
    });
  });

  it.each([
    0,
    -1,
    Number.NaN,
  ])('does not schedule anything for a non-positive funded amount (%s)', async (fundedAmount) => {
    const scheduleAfter = vi.fn();

    await scheduleWalletFundedCreditNotification({
      ...baseArgs,
      fundedAmount,
      scheduleAfter,
      supabase: createClaimingSupabase() as never,
    });

    expect(scheduleAfter).not.toHaveBeenCalled();
    expect(mockNotifyWalletCredited).not.toHaveBeenCalled();
  });

  it('swallows and logs a notification failure so the webhook is never affected', async () => {
    mockNotifyWalletCredited.mockRejectedValueOnce(new Error('expo down'));
    const tasks: Array<() => Promise<void>> = [];

    await scheduleWalletFundedCreditNotification({
      ...baseArgs,
      fundedAmount: 20_000,
      scheduleAfter: (task) => tasks.push(task),
      supabase: createClaimingSupabase() as never,
    });

    await expect(tasks[0]?.()).resolves.toBeUndefined();
    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'expo down',
        gatewayReference: 'PSK_REF_1',
      })
    );
  });

  it('does not schedule when another webhook already claimed the transfer', async () => {
    const tasks: Array<() => Promise<void>> = [];

    scheduleWalletFundedCreditNotification({
      ...baseArgs,
      fundedAmount: 20_000,
      scheduleAfter: (task) => tasks.push(task),
      supabase: createClaimingSupabase(false) as never,
    });

    await tasks[0]?.();
    expect(mockNotifyWalletCredited).not.toHaveBeenCalled();
  });
});
