import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockSetNotificationChannelAsync =
  jest.fn<(channelId: string, channel: unknown) => Promise<null>>();

jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3, HIGH: 4 },
  setNotificationChannelAsync: mockSetNotificationChannelAsync,
}));

import { ensureAndroidNotificationChannels } from './push-notification-channels';

describe('ensureAndroidNotificationChannels', () => {
  beforeEach(() => {
    mockSetNotificationChannelAsync.mockClear();
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
});
