import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockDebug = jest.fn();
const mockError = jest.fn();
const mockInfo = jest.fn();
const mockWarn = jest.fn();
const mockGetRandomBytesAsync = jest.fn();
const mockRandomUUID = jest.fn();
const mockGetTrackingPermissionStatus =
  jest.fn<() => Promise<{ status: string }>>();
const mockRequestTrackingPermissionStatus =
  jest.fn<() => Promise<{ status: string }>>();

type MockFBSettings = {
  initializeSDK?: () => void;
  setAdvertiserTrackingEnabled?: (enabled: boolean) => Promise<boolean> | void;
};

type MockAppEventsLogger = {
  logEvent?: (
    name: string,
    valueToSumOrParams?: number | Record<string, unknown>,
    params?: Record<string, unknown>
  ) => void;
  logPurchase?: (
    amount: number,
    currency: string,
    params?: Record<string, unknown>
  ) => void;
};

type MockAEMReporterIOS = {
  logAEMEvent?: (
    name: string,
    value: number,
    currency: string,
    params: Record<string, unknown>
  ) => void;
};

type MockTikTokBusiness = {
  initialize?: () => boolean;
  isInitialized?: () => boolean;
  trackEvent?: (
    name: string,
    eventId?: string,
    eventData?: unknown[]
  ) => void;
};

type MockNativeModules = {
  AEMReporterIOS: MockAEMReporterIOS | null;
  AppEventsLogger: MockAppEventsLogger | null;
  FBSettings: MockFBSettings | null;
  TikTokBusiness: MockTikTokBusiness | null;
};

const mockLoadAdTrackingNativeModules =
  jest.fn<() => Promise<MockNativeModules>>();

let mockPlatformOS: 'ios' | 'android' | 'web' = 'ios';
let mockExpoConfigExtra: Record<string, unknown> = {
  apiUrl: 'https://api.test',
  facebookAppId: 'fb-test',
  facebookClientToken: 'client-test',
  tiktokBusiness: {
    isConfigured: false,
  },
};

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return {
        extra: mockExpoConfigExtra,
      };
    },
  },
}));

jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: mockGetRandomBytesAsync,
  randomUUID: mockRandomUUID,
}));

jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockPlatformOS;
    },
  },
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: mockDebug,
    error: mockError,
    info: mockInfo,
    warn: mockWarn,
  }),
}));

jest.mock('@/lib/tracking-transparency', () => ({
  getTrackingPermissionStatus: mockGetTrackingPermissionStatus,
  requestTrackingPermissionStatus: mockRequestTrackingPermissionStatus,
}));

jest.mock('./ad-tracking-native-modules', () => ({
  loadAdTrackingNativeModules: mockLoadAdTrackingNativeModules,
}));

function createNativeModules(
  overrides: Partial<MockNativeModules> = {}
): MockNativeModules {
  return {
    AEMReporterIOS: null,
    AppEventsLogger: null,
    FBSettings: null,
    TikTokBusiness: null,
    ...overrides,
  };
}

describe('ad-tracking runtime', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockPlatformOS = 'ios';
    mockExpoConfigExtra = {
      apiUrl: 'https://api.test',
      facebookAppId: 'fb-test',
      facebookClientToken: 'client-test',
      tiktokBusiness: {
        isConfigured: false,
      },
    };
    mockGetTrackingPermissionStatus.mockResolvedValue({ status: 'denied' });
    mockRequestTrackingPermissionStatus.mockResolvedValue({
      status: 'granted',
    });
    mockLoadAdTrackingNativeModules.mockResolvedValue(createNativeModules());
  });

  it('does not fail initialization when the Facebook native bridge is partial', async () => {
    const nativeBridgeError = new TypeError('undefined is not a function');
    const setAdvertiserTrackingEnabled = jest.fn(() => {
      throw nativeBridgeError;
    });
    const initializeSDK = jest.fn(() => {
      throw nativeBridgeError;
    });
    mockLoadAdTrackingNativeModules.mockResolvedValue(
      createNativeModules({
        FBSettings: {
          initializeSDK,
          setAdvertiserTrackingEnabled,
        },
      })
    );

    const { initAdTracking } = await import('./ad-tracking-runtime');

    await initAdTracking();

    expect(setAdvertiserTrackingEnabled).toHaveBeenCalledWith(false);
    expect(initializeSDK).toHaveBeenCalledTimes(1);
    expect(mockWarn).toHaveBeenCalledWith(
      'Facebook advertiser tracking update failed:',
      nativeBridgeError
    );
    expect(mockWarn).toHaveBeenCalledWith(
      'Facebook SDK initialization failed:',
      nativeBridgeError
    );
    expect(mockError).not.toHaveBeenCalledWith(
      'Initialization error:',
      expect.anything()
    );
    expect(mockInfo).toHaveBeenCalledWith(
      'Initialized. Server-side tracking enabled. ATT:',
      false
    );
  });

  it('logs rejected native module promises without failing initialization', async () => {
    const nativeBridgeError = new TypeError('async bridge failure');
    const setAdvertiserTrackingEnabled = jest.fn(() =>
      Promise.reject(nativeBridgeError)
    );
    mockLoadAdTrackingNativeModules.mockResolvedValue(
      createNativeModules({
        FBSettings: {
          initializeSDK: jest.fn(),
          setAdvertiserTrackingEnabled,
        },
      })
    );

    const { initAdTracking } = await import('./ad-tracking-runtime');

    await initAdTracking();
    await Promise.resolve();

    expect(setAdvertiserTrackingEnabled).toHaveBeenCalledWith(false);
    expect(mockWarn).toHaveBeenCalledWith(
      'Facebook advertiser tracking update failed:',
      nativeBridgeError
    );
    expect(mockError).not.toHaveBeenCalledWith(
      'Initialization error:',
      expect.anything()
    );
  });

  it('returns the ATT permission result when the Facebook tracking update fails', async () => {
    const nativeBridgeError = new TypeError('undefined is not a function');
    const setAdvertiserTrackingEnabled = jest.fn(() => {
      throw nativeBridgeError;
    });
    mockLoadAdTrackingNativeModules.mockResolvedValue(
      createNativeModules({
        FBSettings: {
          initializeSDK: jest.fn(),
          setAdvertiserTrackingEnabled,
        },
      })
    );

    const { initAdTracking, requestTrackingPermission } = await import(
      './ad-tracking-runtime'
    );

    await initAdTracking();
    mockError.mockClear();
    mockWarn.mockClear();
    setAdvertiserTrackingEnabled.mockClear();

    await expect(requestTrackingPermission()).resolves.toBe('granted');

    expect(setAdvertiserTrackingEnabled).toHaveBeenCalledWith(true);
    expect(mockWarn).toHaveBeenCalledWith(
      'Facebook advertiser tracking update failed:',
      nativeBridgeError
    );
    expect(mockError).not.toHaveBeenCalledWith(
      'ATT request error:',
      expect.anything()
    );
  });

  it('keeps client backup tracking non-fatal when native event logging fails', async () => {
    const facebookEventError = new TypeError('undefined is not a function');
    const aemEventError = new TypeError('undefined is not a function');
    mockLoadAdTrackingNativeModules.mockResolvedValue(
      createNativeModules({
        AEMReporterIOS: {
          logAEMEvent: jest.fn(() => {
            throw aemEventError;
          }),
        },
        AppEventsLogger: {
          logEvent: jest.fn(() => {
            throw facebookEventError;
          }),
        },
      })
    );

    const { initAdTracking, sendClientBackup } = await import(
      './ad-tracking-runtime'
    );

    await initAdTracking();

    expect(() => {
      sendClientBackup(
        'evt-1',
        'fb_mobile_add_to_cart',
        null,
        4500,
        'NGN',
        { content_name: 'Phone' }
      );
    }).not.toThrow();
    expect(mockWarn).toHaveBeenCalledWith(
      'Facebook event log failed:',
      facebookEventError
    );
    expect(mockWarn).toHaveBeenCalledWith(
      'Facebook AEM event log failed:',
      aemEventError
    );
  });
});
