import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockSetNotificationChannelAsync =
  jest.fn<(channelId: string, channel: unknown) => Promise<null>>();
const mockWarn = jest.fn();

jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3, HIGH: 4 },
  setNotificationChannelAsync: mockSetNotificationChannelAsync,
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ warn: (...args: unknown[]) => mockWarn(...args) }),
}));

import { ensureAndroidNotificationChannels } from './push-notification-channels';

describe('ensureAndroidNotificationChannels', () => {
  beforeEach(() => {
    mockSetNotificationChannelAsync.mockClear();
    mockWarn.mockClear();
    mockSetNotificationChannelAsync.mockResolvedValue(null);
  });

  it('creates all four channels including payments', async () => {
    await ensureAndroidNotificationChannels();

    // The payments channel must exist before a wallet-credited push targets
    // it on Android 8+. (Platform gating lives at the call sites; the expo
    // API is a no-op off Android.)
    const channelIds = mockSetNotificationChannelAsync.mock.calls.map(
      (call) => call[0]
    );
    expect(channelIds).toEqual(['orders', 'payments', 'promotions', 'general']);
  });

  it('is idempotent across repeated calls', async () => {
    await ensureAndroidNotificationChannels();
    await ensureAndroidNotificationChannels();

    expect(mockSetNotificationChannelAsync).toHaveBeenCalledTimes(8);
  });

  it('continues creating later channels when one registration fails', async () => {
    mockSetNotificationChannelAsync.mockRejectedValueOnce(
      new Error('orders unavailable')
    );

    await expect(ensureAndroidNotificationChannels()).resolves.toBeUndefined();

    expect(
      mockSetNotificationChannelAsync.mock.calls.map(([id]) => id)
    ).toEqual(['orders', 'payments', 'promotions', 'general']);
    expect(mockWarn).toHaveBeenLastCalledWith(
      'Android notification channel registration failed.',
      expect.objectContaining({ channel: 'orders' })
    );
  });
});
