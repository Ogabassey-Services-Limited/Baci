import { describe, expect, it, jest } from '@jest/globals';
import { Platform } from 'react-native';

const mockSetNotificationChannelAsync =
  jest.fn<(channelId: string, channel: unknown) => Promise<null>>();

jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3, HIGH: 4 },
  setNotificationChannelAsync: mockSetNotificationChannelAsync,
}));

import { ensureAndroidNotificationChannels } from './push-notification-channels';

function withPlatformOS(os: string, run: () => Promise<void>): Promise<void> {
  const originalOS = Platform.OS;
  Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
  return run().finally(() => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: originalOS,
    });
  });
}

describe('ensureAndroidNotificationChannels', () => {
  it('creates all four channels including payments on Android', async () => {
    await withPlatformOS('android', async () => {
      mockSetNotificationChannelAsync.mockClear();

      await ensureAndroidNotificationChannels();

      const channelIds = mockSetNotificationChannelAsync.mock.calls.map(
        (call) => call[0]
      );
      expect(channelIds).toEqual([
        'orders',
        'payments',
        'promotions',
        'general',
      ]);
    });
  });

  it('is a no-op off Android', async () => {
    await withPlatformOS('ios', async () => {
      mockSetNotificationChannelAsync.mockClear();

      await ensureAndroidNotificationChannels();

      expect(mockSetNotificationChannelAsync).not.toHaveBeenCalled();
    });
  });
});
