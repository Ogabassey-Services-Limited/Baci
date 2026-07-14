import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockNotifyWalletCredited = vi.fn<(...args: unknown[]) => Promise<void>>();
const mockWarn = vi.fn();
const mockClaimWalletCreditPush = vi.hoisted(() => vi.fn());

vi.mock('@/lib/payments/claim-wallet-credit-push', () => ({
  claimWalletCreditPush: (...args: unknown[]) =>
    mockClaimWalletCreditPush(...args),
}));

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
};

describe('scheduleWalletFundedCreditNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotifyWalletCredited.mockResolvedValue(undefined);
    mockClaimWalletCreditPush.mockResolvedValue({ status: 'claimed' });
  });

  it('schedules a merchant-scoped wallet credit push for the funded amount', async () => {
    const tasks: Array<() => Promise<void>> = [];

    await scheduleWalletFundedCreditNotification({
      ...baseArgs,
      fundedAmount: 20_000,
      scheduleAfter: (task) => tasks.push(task),
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
    mockClaimWalletCreditPush.mockResolvedValueOnce({
      status: 'already_claimed',
    });

    scheduleWalletFundedCreditNotification({
      ...baseArgs,
      fundedAmount: 20_000,
      scheduleAfter: (task) => tasks.push(task),
    });

    await tasks[0]?.();
    expect(mockNotifyWalletCredited).not.toHaveBeenCalled();
  });

  it('retries a transient claim error before sending', async () => {
    const tasks: Array<() => Promise<void>> = [];
    mockClaimWalletCreditPush
      .mockResolvedValueOnce({ error: 'connection reset', status: 'error' })
      .mockResolvedValueOnce({ status: 'claimed' });

    scheduleWalletFundedCreditNotification({
      ...baseArgs,
      fundedAmount: 20_000,
      scheduleAfter: (task) => tasks.push(task),
    });

    await tasks[0]?.();
    expect(mockClaimWalletCreditPush).toHaveBeenCalledTimes(2);
    expect(mockNotifyWalletCredited).toHaveBeenCalledTimes(1);
  });
});
