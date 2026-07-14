import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockNotifyWalletCredited = vi.fn();
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

import { scheduleWalletTopUpCreditNotification } from './schedule-wallet-top-up-credit-notification';

function makeScheduleAfter() {
  const tasks: Array<() => Promise<void>> = [];
  const scheduleAfter = vi.fn((task: () => Promise<void>) => {
    tasks.push(task);
  });
  return { scheduleAfter, tasks };
}

const baseArgs = {
  amount: 2500,
  customerId: 'customer-1',
  merchantId: 'merchant-1',
  reference: 'WAL-123',
};

describe('scheduleWalletTopUpCreditNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotifyWalletCredited.mockResolvedValue(undefined);
  });

  it('schedules a merchant-scoped push when the caller took the first credit', async () => {
    const { scheduleAfter, tasks } = makeScheduleAfter();

    scheduleWalletTopUpCreditNotification({
      ...baseArgs,
      currency: 'NGN',
      firstCredit: true,
      metadata: { return_to: '/checkout' },
      scheduleAfter,
    });
    await Promise.all(tasks.map((task) => task()));

    expect(scheduleAfter).toHaveBeenCalledTimes(1);
    expect(mockNotifyWalletCredited).toHaveBeenCalledTimes(1);
    expect(mockNotifyWalletCredited).toHaveBeenCalledWith({
      amount: 2500,
      currency: 'NGN',
      customerId: 'customer-1',
      merchantId: 'merchant-1',
      returnTo: '/checkout',
    });
  });

  it('does not schedule anything when the credit was an idempotent replay', () => {
    const { scheduleAfter } = makeScheduleAfter();

    scheduleWalletTopUpCreditNotification({
      ...baseArgs,
      firstCredit: false,
      metadata: { return_to: '/checkout' },
      scheduleAfter,
    });

    expect(scheduleAfter).not.toHaveBeenCalled();
    expect(mockNotifyWalletCredited).not.toHaveBeenCalled();
  });

  it('prefers the camelCase metadata key and accepts utility destinations', async () => {
    const { scheduleAfter, tasks } = makeScheduleAfter();

    scheduleWalletTopUpCreditNotification({
      ...baseArgs,
      firstCredit: true,
      metadata: { returnTo: '/utilities/airtime', return_to: '/checkout' },
      scheduleAfter,
    });
    await Promise.all(tasks.map((task) => task()));

    expect(mockNotifyWalletCredited).toHaveBeenCalledWith(
      expect.objectContaining({ returnTo: '/utilities/airtime' })
    );
  });

  it('drops a non-resumable metadata destination instead of deep-linking to it', async () => {
    const { scheduleAfter, tasks } = makeScheduleAfter();

    scheduleWalletTopUpCreditNotification({
      ...baseArgs,
      firstCredit: true,
      metadata: { return_to: '/auth/callback?returnTo=//evil.com' },
      scheduleAfter,
    });
    await Promise.all(tasks.map((task) => task()));

    expect(mockNotifyWalletCredited).toHaveBeenCalledWith(
      expect.objectContaining({ returnTo: undefined })
    );
  });

  it('skips scheduling for a non-positive or non-finite amount', () => {
    const { scheduleAfter } = makeScheduleAfter();

    scheduleWalletTopUpCreditNotification({
      ...baseArgs,
      amount: 0,
      firstCredit: true,
      metadata: {},
      scheduleAfter,
    });
    scheduleWalletTopUpCreditNotification({
      ...baseArgs,
      amount: Number.NaN,
      firstCredit: true,
      metadata: {},
      scheduleAfter,
    });

    expect(scheduleAfter).not.toHaveBeenCalled();
  });

  it('swallows a push failure so it can never surface on the payment path', async () => {
    const { scheduleAfter, tasks } = makeScheduleAfter();
    mockNotifyWalletCredited.mockRejectedValue(new Error('expo down'));

    scheduleWalletTopUpCreditNotification({
      ...baseArgs,
      firstCredit: true,
      metadata: {},
      scheduleAfter,
    });

    await expect(
      Promise.all(tasks.map((task) => task()))
    ).resolves.toBeDefined();
    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'expo down', reference: 'WAL-123' })
    );
  });
});
