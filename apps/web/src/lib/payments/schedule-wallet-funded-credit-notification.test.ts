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
};

describe('scheduleWalletFundedCreditNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotifyWalletCredited.mockResolvedValue(undefined);
  });

  it('schedules a merchant-scoped wallet credit push for the funded amount', async () => {
    const tasks: Array<() => Promise<void>> = [];

    scheduleWalletFundedCreditNotification({
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
    });
  });

  it.each([
    0,
    -1,
    Number.NaN,
  ])('does not schedule anything for a non-positive funded amount (%s)', (fundedAmount) => {
    const scheduleAfter = vi.fn();

    scheduleWalletFundedCreditNotification({
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

    scheduleWalletFundedCreditNotification({
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
});
