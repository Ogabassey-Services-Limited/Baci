import { beforeEach, describe, expect, it, vi } from 'vitest';

let runtimePlatform = 'android';

vi.mock('@/config/runtime-platform', () => ({
  isRuntimePlatform: (platform: string) => platform === runtimePlatform,
}));

describe('push-notification-native-modules', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doUnmock('expo-device');
    vi.doUnmock('expo-notifications');
    runtimePlatform = 'android';
  });

  it('does not import native notification modules on web', async () => {
    runtimePlatform = 'web';
    vi.doMock('expo-device', () => {
      throw new Error('should not load device module');
    });

    const { getPushNotificationRuntime } = await import(
      './push-notification-native-modules'
    );

    await expect(getPushNotificationRuntime()).resolves.toEqual({
      Device: null,
      Notifications: null,
    });
  });

  it('loads notifications on physical devices and configures the handler', async () => {
    const setNotificationHandler = vi.fn();
    vi.doMock('expo-device', () => ({
      isDevice: true,
      modelName: 'Pixel 9',
    }));
    vi.doMock('expo-notifications', () => ({
      setNotificationHandler,
    }));

    const { getLoadedPushDeviceModule, getPushNotificationRuntime } =
      await import('./push-notification-native-modules');

    const runtime = await getPushNotificationRuntime();

    expect(runtime.Device?.isDevice).toBe(true);
    expect(runtime.Notifications).toBeTruthy();
    expect(getLoadedPushDeviceModule()?.modelName).toBe('Pixel 9');
    expect(setNotificationHandler).toHaveBeenCalledWith({
      handleNotification: expect.any(Function),
    });
  });
});
