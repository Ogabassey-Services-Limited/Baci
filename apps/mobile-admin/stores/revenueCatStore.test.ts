import type { PurchasesPackage } from 'react-native-purchases';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockPurchases = vi.hoisted(() => ({
  addCustomerInfoUpdateListener: vi.fn(),
  configure: vi.fn(),
  getCustomerInfo: vi.fn(),
  getOfferings: vi.fn(),
  purchasePackage: vi.fn(),
  restorePurchases: vi.fn(),
}));

function mockNativeRuntime({ isDevice }: { isDevice: boolean }) {
  vi.doMock('react-native-purchases', () => ({
    default: mockPurchases,
  }));
  vi.doMock('expo-device', () => ({
    isDevice,
  }));
  vi.doMock('@/config/runtime-platform', () => ({
    getRuntimePlatform: () => 'android',
    isRuntimePlatform: (platform: string) => platform === 'android',
    selectRuntimePlatform: <T>(options: { android?: T; default?: T }) =>
      options.android ?? options.default,
  }));
}

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
    mockNativeRuntime({ isDevice: false });
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
    mockNativeRuntime({ isDevice: true });

    const { useRevenueCatStore } = await import('@/stores/revenueCatStore');

    await useRevenueCatStore.getState().initialize();

    expect(mockPurchases.configure).toHaveBeenCalledWith({
      apiKey: 'android-key',
    });
    expect(mockPurchases.getCustomerInfo).toHaveBeenCalledTimes(1);
    expect(mockPurchases.getOfferings).toHaveBeenCalledTimes(1);
    expect(useRevenueCatStore.getState().isInitialized).toBe(true);
  });

  it('returns cancelled purchase status without store errors when user cancels', async () => {
    mockPurchases.getCustomerInfo.mockResolvedValue({
      entitlements: { active: {} },
    });
    mockPurchases.getOfferings.mockResolvedValue({ current: null });
    mockPurchases.addCustomerInfoUpdateListener.mockReturnValue(vi.fn());
    mockPurchases.purchasePackage.mockRejectedValue({
      message: 'Cancelled by user',
      userCancelled: true,
    });
    mockNativeRuntime({ isDevice: true });

    const { useRevenueCatStore } = await import('@/stores/revenueCatStore');
    await useRevenueCatStore.getState().initialize();

    const purchasePackage = {
      product: { identifier: 'pro_monthly' },
    } as unknown as PurchasesPackage;
    const result = await useRevenueCatStore
      .getState()
      .purchasePackage(purchasePackage);

    expect(result).toEqual({ status: 'cancelled' });
    expect(useRevenueCatStore.getState().error).toBeNull();
    expect(useRevenueCatStore.getState().isLoading).toBe(false);
  });

  it('returns error purchase status and sets store error on non-cancelled failures', async () => {
    mockPurchases.getCustomerInfo.mockResolvedValue({
      entitlements: { active: {} },
    });
    mockPurchases.getOfferings.mockResolvedValue({ current: null });
    mockPurchases.addCustomerInfoUpdateListener.mockReturnValue(vi.fn());
    mockPurchases.purchasePackage.mockRejectedValue({
      message: 'Purchase failed',
      userCancelled: false,
    });
    mockNativeRuntime({ isDevice: true });

    const { useRevenueCatStore } = await import('@/stores/revenueCatStore');
    await useRevenueCatStore.getState().initialize();

    const purchasePackage = {
      product: { identifier: 'pro_monthly' },
    } as unknown as PurchasesPackage;
    const result = await useRevenueCatStore
      .getState()
      .purchasePackage(purchasePackage);

    expect(result).toEqual({
      error: 'Purchase failed',
      status: 'error',
    });
    expect(useRevenueCatStore.getState().error).toBe('Purchase failed');
    expect(useRevenueCatStore.getState().isLoading).toBe(false);
  });

  it('reload re-fetches offerings after an initially empty offering', async () => {
    const offeringWithPackages = {
      availablePackages: [{ identifier: 'monthly' }],
      identifier: 'default',
    };
    mockPurchases.getCustomerInfo.mockResolvedValue({
      entitlements: { active: {} },
    });
    // First load returns an empty offering (Play products still propagating);
    // the reload re-queries and now sees the configured packages.
    mockPurchases.getOfferings
      .mockResolvedValueOnce({ current: null })
      .mockResolvedValueOnce({ current: offeringWithPackages });
    mockPurchases.addCustomerInfoUpdateListener.mockReturnValue(vi.fn());
    mockNativeRuntime({ isDevice: true });

    const { useRevenueCatStore } = await import('@/stores/revenueCatStore');

    await useRevenueCatStore.getState().initialize();
    expect(useRevenueCatStore.getState().currentOffering).toBeNull();

    await useRevenueCatStore.getState().reload();

    expect(mockPurchases.getOfferings).toHaveBeenCalledTimes(2);
    expect(useRevenueCatStore.getState().currentOffering).toEqual(
      offeringWithPackages
    );
    expect(useRevenueCatStore.getState().isInitialized).toBe(true);
    expect(useRevenueCatStore.getState().isLoading).toBe(false);
    expect(useRevenueCatStore.getState().error).toBeNull();
  });
});
