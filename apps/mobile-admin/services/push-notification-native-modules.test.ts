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
    const loadDevice = vi.fn(() => ({
      isDevice: true,
      modelName: 'Pixel 9',
    }));
    const loadNotifications = vi.fn(() => ({
      setNotificationHandler,
    }));
    vi.doMock('expo-device', loadDevice);
    vi.doMock('expo-notifications', loadNotifications);

    const { getLoadedPushDeviceModule, getPushNotificationRuntime } =
      await import('./push-notification-native-modules');

    const runtime = await getPushNotificationRuntime();
    const secondRuntime = await getPushNotificationRuntime();

    expect(runtime.Device?.isDevice).toBe(true);
    expect(runtime.Notifications).toBeTruthy();
    expect(secondRuntime.Notifications).toBe(runtime.Notifications);
    expect(getLoadedPushDeviceModule()?.modelName).toBe('Pixel 9');
    expect(loadDevice).toHaveBeenCalledTimes(1);
    expect(loadNotifications).toHaveBeenCalledTimes(1);
    expect(setNotificationHandler).toHaveBeenCalledWith({
      handleNotification: expect.any(Function),
    });
    expect(setNotificationHandler).toHaveBeenCalledTimes(1);
  });

  it('caches unsupported simulator state instead of retrying native imports', async () => {
    const loadDevice = vi.fn(() => ({
      isDevice: false,
      modelName: 'Android Emulator',
    }));
    const loadNotifications = vi.fn(() => ({
      setNotificationHandler: vi.fn(),
    }));
    vi.doMock('expo-device', loadDevice);
    vi.doMock('expo-notifications', loadNotifications);

    const { getPushNotificationRuntime, getPushNotificationsModule } =
      await import('./push-notification-native-modules');

    await expect(getPushNotificationRuntime()).resolves.toMatchObject({
      Notifications: null,
    });
    await expect(getPushNotificationRuntime()).resolves.toMatchObject({
      Notifications: null,
    });
    await expect(getPushNotificationsModule()).resolves.toBeNull();

    expect(loadDevice).toHaveBeenCalledTimes(1);
    expect(loadNotifications).not.toHaveBeenCalled();
  });
});
