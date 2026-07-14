import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockNotifyWalletCredited = vi.fn();
const mockWarn = vi.fn();
const mockClaimWalletCreditPush = vi.fn();
const mockReleaseWalletCreditPush = vi.fn();

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

vi.mock('@/lib/payments/claim-wallet-credit-push', () => ({
  claimWalletCreditPush: (...args: unknown[]) =>
    mockClaimWalletCreditPush(...args),
}));

vi.mock('@/lib/payments/release-wallet-credit-push', () => ({
  releaseWalletCreditPush: (...args: unknown[]) =>
    mockReleaseWalletCreditPush(...args),
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
  transactionId: 'transaction-1',
};

describe('scheduleWalletTopUpCreditNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotifyWalletCredited.mockResolvedValue({ status: 'sent' });
    mockClaimWalletCreditPush.mockResolvedValue({ status: 'claimed' });
    mockReleaseWalletCreditPush.mockResolvedValue({ status: 'released' });
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

  it('does not send when an idempotent replay finds a completed claim', async () => {
    const { scheduleAfter, tasks } = makeScheduleAfter();
    mockClaimWalletCreditPush.mockResolvedValueOnce({
      status: 'already_claimed',
    });

    scheduleWalletTopUpCreditNotification({
      ...baseArgs,
      firstCredit: false,
      metadata: { return_to: '/checkout' },
      scheduleAfter,
    });
    await Promise.all(tasks.map((task) => task()));

    expect(scheduleAfter).toHaveBeenCalledTimes(1);
    expect(mockNotifyWalletCredited).not.toHaveBeenCalled();
  });

  it('claims a concurrent top-up notification only once', async () => {
    const { scheduleAfter, tasks } = makeScheduleAfter();
    mockClaimWalletCreditPush
      .mockResolvedValueOnce({ status: 'claimed' })
      .mockResolvedValueOnce({ status: 'already_claimed' });

    scheduleWalletTopUpCreditNotification({
      ...baseArgs,
      firstCredit: true,
      metadata: {},
      scheduleAfter,
    });
    scheduleWalletTopUpCreditNotification({
      ...baseArgs,
      firstCredit: true,
      metadata: {},
      scheduleAfter,
    });
    await Promise.all(tasks.map((task) => task()));

    expect(mockNotifyWalletCredited).toHaveBeenCalledTimes(1);
  });

  it('retries a transient claim error before sending', async () => {
    const { scheduleAfter, tasks } = makeScheduleAfter();
    mockClaimWalletCreditPush
      .mockResolvedValueOnce({ error: 'connection reset', status: 'error' })
      .mockResolvedValueOnce({ status: 'claimed' });

    scheduleWalletTopUpCreditNotification({
      ...baseArgs,
      firstCredit: true,
      metadata: {},
      scheduleAfter,
    });
    await Promise.all(tasks.map((task) => task()));

    expect(mockClaimWalletCreditPush).toHaveBeenCalledTimes(2);
    expect(mockNotifyWalletCredited).toHaveBeenCalledTimes(1);
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

  it('releases a failed delivery claim so an idempotent replay can retry', async () => {
    const first = makeScheduleAfter();
    mockNotifyWalletCredited
      .mockResolvedValueOnce({ status: 'retryable_error' })
      .mockResolvedValueOnce({ status: 'sent' });

    scheduleWalletTopUpCreditNotification({
      ...baseArgs,
      firstCredit: true,
      metadata: {},
      scheduleAfter: first.scheduleAfter,
    });
    await Promise.all(first.tasks.map((task) => task()));

    expect(mockReleaseWalletCreditPush).toHaveBeenCalledWith({
      claimToken: expect.any(String),
      reference: 'WAL-123',
      transactionId: 'transaction-1',
    });
    expect(mockClaimWalletCreditPush.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        claimToken: mockReleaseWalletCreditPush.mock.calls[0]?.[0].claimToken,
      })
    );
    expect(mockReleaseWalletCreditPush).toHaveBeenCalledTimes(1);

    const replay = makeScheduleAfter();
    scheduleWalletTopUpCreditNotification({
      ...baseArgs,
      firstCredit: false,
      metadata: {},
      scheduleAfter: replay.scheduleAfter,
    });
    await Promise.all(replay.tasks.map((task) => task()));

    expect(mockNotifyWalletCredited).toHaveBeenCalledTimes(2);
  });

  it('retries a transient claim-release error once', async () => {
    const { scheduleAfter, tasks } = makeScheduleAfter();
    mockNotifyWalletCredited.mockResolvedValueOnce({
      status: 'retryable_error',
    });
    mockReleaseWalletCreditPush
      .mockResolvedValueOnce({ error: 'connection reset', status: 'error' })
      .mockResolvedValueOnce({ status: 'released' });

    scheduleWalletTopUpCreditNotification({
      ...baseArgs,
      firstCredit: true,
      metadata: {},
      scheduleAfter,
    });
    await Promise.all(tasks.map((task) => task()));

    expect(mockReleaseWalletCreditPush).toHaveBeenCalledTimes(2);
    expect(mockWarn).not.toHaveBeenCalled();
  });

  it('logs a claim-release failure when notification delivery throws', async () => {
    const { scheduleAfter, tasks } = makeScheduleAfter();
    mockNotifyWalletCredited.mockRejectedValueOnce(new Error('sender crashed'));
    mockReleaseWalletCreditPush.mockResolvedValue({
      error: 'database unavailable',
      status: 'error',
    });

    scheduleWalletTopUpCreditNotification({
      ...baseArgs,
      firstCredit: true,
      metadata: {},
      scheduleAfter,
    });
    await Promise.all(tasks.map((task) => task()));

    expect(mockReleaseWalletCreditPush).toHaveBeenCalledTimes(2);
    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining('release failed after retry'),
      })
    );
  });

  it('swallows a synchronous schedule registration failure', () => {
    const scheduleAfter = vi.fn(() => {
      throw new Error('scheduler unavailable');
    });

    expect(() =>
      scheduleWalletTopUpCreditNotification({
        ...baseArgs,
        firstCredit: true,
        metadata: {},
        scheduleAfter,
      })
    ).not.toThrow();
    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'scheduler unavailable',
        reference: 'WAL-123',
      })
    );
  });
});
