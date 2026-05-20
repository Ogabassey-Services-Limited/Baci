import { beforeEach, describe, expect, it, vi } from 'vitest';

let runtimePlatform = 'android';

const runtimePlatformMock = {
  getRuntimePlatform: vi.fn(() => runtimePlatform),
  isRuntimePlatform: vi.fn((platform: string) => platform === runtimePlatform),
};

const supabaseFromMock = vi.fn();

vi.mock('@baci/shared', () => ({
  getAdminNotificationNavigationTarget: vi.fn(() => null),
}));

vi.mock('@/config/runtime-platform', () => runtimePlatformMock);

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: supabaseFromMock,
  },
}));

vi.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {
        eas: {
          projectId: 'test-project-id',
        },
      },
    },
  },
}));

describe('push notification native loading', () => {
  function mockPhysicalDevice() {
    vi.doMock('expo-device', () => ({
      isDevice: true,
      modelName: 'Pixel 9',
    }));
  }

  function createNotificationModule(
    overrides: Record<string, unknown> = {}
  ) {
    return {
      AndroidImportance: {
        DEFAULT: 3,
        HIGH: 4,
        LOW: 2,
      },
      getExpoPushTokenAsync: vi.fn(() =>
        Promise.resolve({ data: 'ExponentPushToken[test]' })
      ),
      getPermissionsAsync: vi.fn(() => Promise.resolve({ status: 'granted' })),
      requestPermissionsAsync: vi.fn(() =>
        Promise.resolve({ status: 'granted' })
      ),
      setNotificationChannelAsync: vi.fn(() => Promise.resolve()),
      setNotificationHandler: vi.fn(),
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doUnmock('expo-device');
    vi.doUnmock('expo-notifications');
    runtimePlatform = 'android';
    runtimePlatformMock.getRuntimePlatform.mockImplementation(
      () => runtimePlatform
    );
    runtimePlatformMock.isRuntimePlatform.mockImplementation(
      (platform: string) => platform === runtimePlatform
    );
  });

  it('skips the notifications module on simulators', async () => {
    const notificationModule = {
      setNotificationHandler: vi.fn(),
      getExpoPushTokenAsync: vi.fn(),
    };

    vi.doMock('expo-device', () => ({
      isDevice: false,
      modelName: 'Android Emulator',
    }));
    vi.doMock('expo-notifications', () => notificationModule);

    const { registerForPushNotifications } = await import(
      './push-notifications'
    );

    await expect(registerForPushNotifications()).resolves.toBeNull();
    expect(notificationModule.setNotificationHandler).not.toHaveBeenCalled();
    expect(notificationModule.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('registers a push token on physical devices', async () => {
    const notificationModule = createNotificationModule();

    mockPhysicalDevice();
    vi.doMock('expo-notifications', () => notificationModule);

    const { registerForPushNotifications } = await import(
      './push-notifications'
    );

    await expect(registerForPushNotifications()).resolves.toBe(
      'ExponentPushToken[test]'
    );
    expect(notificationModule.setNotificationHandler).toHaveBeenCalled();
    expect(notificationModule.getExpoPushTokenAsync).toHaveBeenCalledWith({
      projectId: 'test-project-id',
    });
  });

  it('returns null when a physical device denies push permissions', async () => {
    const notificationModule = createNotificationModule({
      getPermissionsAsync: vi.fn(() => Promise.resolve({ status: 'denied' })),
      requestPermissionsAsync: vi.fn(() =>
        Promise.resolve({ status: 'denied' })
      ),
    });

    mockPhysicalDevice();
    vi.doMock('expo-notifications', () => notificationModule);

    const { registerForPushNotifications } = await import(
      './push-notifications'
    );

    await expect(registerForPushNotifications()).resolves.toBeNull();
    expect(notificationModule.requestPermissionsAsync).toHaveBeenCalled();
    expect(notificationModule.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('returns null when Expo push token lookup fails', async () => {
    const notificationModule = createNotificationModule({
      getExpoPushTokenAsync: vi.fn(() => Promise.reject(new Error('boom'))),
    });

    mockPhysicalDevice();
    vi.doMock('expo-notifications', () => notificationModule);

    const { registerForPushNotifications } = await import(
      './push-notifications'
    );

    await expect(registerForPushNotifications()).resolves.toBeNull();
    expect(notificationModule.getExpoPushTokenAsync).toHaveBeenCalled();
  });

  it('still requests a token when the EAS project id is missing', async () => {
    const notificationModule = createNotificationModule();

    mockPhysicalDevice();
    vi.doMock('expo-notifications', () => notificationModule);
    vi.doMock('expo-constants', () => ({
      default: {
        expoConfig: {
          extra: {
            eas: {},
          },
        },
      },
    }));

    const { registerForPushNotifications } = await import(
      './push-notifications'
    );

    await expect(registerForPushNotifications()).resolves.toBe(
      'ExponentPushToken[test]'
    );
    expect(notificationModule.getExpoPushTokenAsync).toHaveBeenCalledWith({
      projectId: undefined,
    });
  });

  it('returns null when the notifications native module cannot be imported', async () => {
    mockPhysicalDevice();
    vi.doMock('expo-notifications', () => {
      throw new Error('native module unavailable');
    });

    const { registerForPushNotifications } = await import(
      './push-notifications'
    );

    await expect(registerForPushNotifications()).resolves.toBeNull();
  });

  it('returns false when saving the push token fails', async () => {
    const upsertMock = vi.fn(() =>
      Promise.resolve({ error: { message: 'RLS policy violation' } })
    );
    supabaseFromMock.mockReturnValue({
      upsert: upsertMock,
    });

    vi.doMock('expo-device', () => ({
      isDevice: false,
      modelName: 'Android Emulator',
    }));
    vi.doMock('expo-notifications', () => createNotificationModule());

    const { savePushTokenToServer } = await import('./push-notifications');

    await expect(
      savePushTokenToServer('ExponentPushToken[test]', 'user-1', 'merchant-1')
    ).resolves.toBe(false);
    expect(supabaseFromMock).toHaveBeenCalledWith('push_tokens');
    expect(upsertMock).toHaveBeenCalled();
  });
});
