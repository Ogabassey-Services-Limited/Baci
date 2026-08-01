import { beforeEach, describe, expect, it, vi } from 'vitest';

let runtimePlatform = 'android';

const runtimePlatformMock = {
  getRuntimePlatform: vi.fn(() => runtimePlatform),
  isRuntimePlatform: vi.fn((platform: string) => platform === runtimePlatform),
};

const supabaseFromMock = vi.fn();
const supabaseRpcMock = vi.fn();

vi.mock('@baci/shared', () => ({
  getAdminNotificationNavigationTarget: vi.fn(() => null),
}));

vi.mock('@/config/runtime-platform', () => runtimePlatformMock);

vi.mock('expo-application', () => ({
  nativeBuildVersion: '42',
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: supabaseFromMock,
    rpc: supabaseRpcMock,
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

  function createNotificationModule(overrides: Record<string, unknown> = {}) {
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
    process.env.EXPO_PUBLIC_ENABLE_REMOTE_PUSH_IN_DEV = '1';
  });

  it('skips remote token registration by default in local development', async () => {
    const notificationModule = createNotificationModule();
    delete process.env.EXPO_PUBLIC_ENABLE_REMOTE_PUSH_IN_DEV;
    mockPhysicalDevice();
    vi.doMock('expo-notifications', () => notificationModule);

    const { registerForPushNotifications } = await import(
      './push-notifications'
    );

    await expect(registerForPushNotifications()).resolves.toBeNull();
    expect(notificationModule.setNotificationHandler).toHaveBeenCalled();
    expect(notificationModule.getPermissionsAsync).not.toHaveBeenCalled();
    expect(notificationModule.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('loads the notifications module but skips push-token registration on simulators', async () => {
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
    expect(notificationModule.setNotificationHandler).toHaveBeenCalled();
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

  it('registers the push token via the register_push_token RPC with the native build number', async () => {
    supabaseRpcMock.mockResolvedValue({ error: null });

    vi.doMock('expo-device', () => ({
      isDevice: true,
      modelName: 'Pixel 9',
    }));
    vi.doMock('expo-notifications', () => createNotificationModule());

    const { savePushTokenToServer } = await import('./push-notifications');

    await expect(
      savePushTokenToServer('ExponentPushToken[test]', 'merchant-1')
    ).resolves.toBe(true);
    expect(supabaseRpcMock).toHaveBeenCalledWith(
      'register_push_token',
      expect.objectContaining({
        p_token: 'ExponentPushToken[test]',
        p_merchant_id: 'merchant-1',
        p_platform: 'android',
        p_app_type: 'admin',
        p_build_number: 42,
        p_shipment_update_capability: 1,
      })
    );
  });

  it.each([
    [null, null],
    ['', null],
    ['   ', null],
    ['646-beta', null],
    ['646.1', null],
    ['-1', null],
    ['0', 0],
    ['646', 646],
    [' 646 ', 646],
  ])('parses native build number %j as %j', async (value, expectedBuildNumber) => {
    const { resolveNativeBuildNumber } = await import('./push-notifications');

    expect(resolveNativeBuildNumber(value)).toBe(expectedBuildNumber);
  });

  it('returns false when saving the push token fails', async () => {
    supabaseRpcMock.mockResolvedValue({
      error: { message: 'RLS policy violation' },
    });

    vi.doMock('expo-device', () => ({
      isDevice: false,
      modelName: 'Android Emulator',
    }));
    vi.doMock('expo-notifications', () => createNotificationModule());

    const { savePushTokenToServer } = await import('./push-notifications');

    await expect(
      savePushTokenToServer('ExponentPushToken[test]', 'merchant-1')
    ).resolves.toBe(false);
    expect(supabaseRpcMock).toHaveBeenCalledWith(
      'register_push_token',
      expect.any(Object)
    );
  });
});
