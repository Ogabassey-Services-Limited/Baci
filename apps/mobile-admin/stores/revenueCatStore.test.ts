import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockPurchases = vi.hoisted(() => ({
  addCustomerInfoUpdateListener: vi.fn(),
  configure: vi.fn(),
  getCustomerInfo: vi.fn(),
  getOfferings: vi.fn(),
  purchasePackage: vi.fn(),
  restorePurchases: vi.fn(),
}));

describe('useRevenueCatStore', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal('__DEV__', true);
    process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID = 'android-key';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID;
  });

  it('skips native purchases initialization on development emulators', async () => {
    vi.doMock('react-native-purchases', () => ({
      default: mockPurchases,
    }));
    vi.doMock('expo-device', () => ({
      isDevice: false,
    }));
    vi.doMock('@/config/runtime-platform', () => ({
      getRuntimePlatform: () => 'android',
      isRuntimePlatform: (platform: string) => platform === 'android',
      selectRuntimePlatform: <T>(options: { android?: T; default?: T }) =>
        options.android ?? options.default,
    }));

    const { useRevenueCatStore } = await import('@/stores/revenueCatStore');

    await useRevenueCatStore.getState().initialize();

    const state = useRevenueCatStore.getState();
    expect(mockPurchases.configure).not.toHaveBeenCalled();
    expect(mockPurchases.getCustomerInfo).not.toHaveBeenCalled();
    expect(mockPurchases.getOfferings).not.toHaveBeenCalled();
    expect(state.isInitialized).toBe(true);
    expect(state.isInitializing).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('initializes native purchases on development real devices', async () => {
    mockPurchases.getCustomerInfo.mockResolvedValue({
      entitlements: { active: {} },
    });
    mockPurchases.getOfferings.mockResolvedValue({ current: null });
    mockPurchases.addCustomerInfoUpdateListener.mockReturnValue(vi.fn());
    vi.doMock('react-native-purchases', () => ({
      default: mockPurchases,
    }));
    vi.doMock('expo-device', () => ({
      isDevice: true,
    }));
    vi.doMock('@/config/runtime-platform', () => ({
      getRuntimePlatform: () => 'android',
      isRuntimePlatform: (platform: string) => platform === 'android',
      selectRuntimePlatform: <T>(options: { android?: T; default?: T }) =>
        options.android ?? options.default,
    }));

    const { useRevenueCatStore } = await import('@/stores/revenueCatStore');

    await useRevenueCatStore.getState().initialize();

    expect(mockPurchases.configure).toHaveBeenCalledWith({
      apiKey: 'android-key',
    });
    expect(mockPurchases.getCustomerInfo).toHaveBeenCalledTimes(1);
    expect(mockPurchases.getOfferings).toHaveBeenCalledTimes(1);
    expect(useRevenueCatStore.getState().isInitialized).toBe(true);
  });
});
