import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockWarn = jest.fn();
const mockInfo = jest.fn();
const mockError = jest.fn();
const mockCapture = jest.fn();
const mockCaptureException = jest.fn();
const mockRegister = jest.fn();
const mockScreen = jest.fn();
const mockIdentify = jest.fn();
const mockReset = jest.fn();
const mockFlush = jest.fn();
const mockShutdown = jest.fn();
const mockIsFeatureEnabled = jest.fn<() => Promise<boolean>>();
const mockGetFeatureFlag =
  jest.fn<() => Promise<string | boolean | undefined>>();
const mockReloadFeatureFlags = jest.fn();
let mockExpoConfigExtra: {
  posthogApiKey: string;
  posthogHost?: string;
  merchantId?: string;
  merchantSlug?: string;
  merchantDomain?: string;
} = {
  posthogApiKey: 'ph_test',
  posthogHost: 'https://posthog.example.com',
  merchantId: 'merchant-1',
  merchantSlug: 'ogabassey',
  merchantDomain: 'ogabassey.com',
};

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    warn: mockWarn,
    info: mockInfo,
    error: mockError,
  }),
}));

jest.mock('expo-constants', () => ({
  expoConfig: {
    get extra() {
      return mockExpoConfigExtra;
    },
  },
}));

jest.mock('posthog-react-native', () =>
  jest.fn().mockImplementation(() => ({
    capture: mockCapture,
    captureException: mockCaptureException,
    register: mockRegister,
    screen: mockScreen,
    identify: mockIdentify,
    reset: mockReset,
    flush: mockFlush,
    shutdown: mockShutdown,
    isFeatureEnabled: mockIsFeatureEnabled,
    getFeatureFlag: mockGetFeatureFlag,
    reloadFeatureFlags: mockReloadFeatureFlags,
  }))
);

describe('analytics core', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockExpoConfigExtra = {
      posthogApiKey: 'ph_test',
      posthogHost: 'https://posthog.example.com',
      merchantId: 'merchant-1',
      merchantSlug: 'ogabassey',
      merchantDomain: 'ogabassey.com',
    };
    jest.useFakeTimers().setSystemTime(new Date('2026-05-29T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('initializes PostHog and tracks events with timestamps', async () => {
    const { initAnalytics, trackEvent, trackScreen } = await import(
      './analytics-core'
    );
    const PostHog = (await import('posthog-react-native')).default;

    await initAnalytics();
    trackEvent('Checkout Started', { subtotal: 2000 });
    trackScreen('Checkout');

    expect(PostHog).toHaveBeenCalledWith(
      'ph_test',
      expect.objectContaining({
        host: 'https://posthog.example.com',
        sessionReplayConfig: expect.objectContaining({
          maskAllTextInputs: true,
          maskAllImages: true,
          maskAllSandboxedViews: true,
          captureLog: false,
          captureNetworkTelemetry: false,
        }),
      })
    );
    expect(mockRegister).toHaveBeenCalledWith({
      app_surface: 'mobile-storefront',
      merchant_id: 'merchant-1',
      merchant_slug: 'ogabassey',
      merchant_domain: 'ogabassey.com',
    });
    expect(mockCapture).toHaveBeenCalledWith('Checkout Started', {
      subtotal: 2000,
      timestamp: '2026-05-29T12:00:00.000Z',
    });
    expect(mockScreen).toHaveBeenCalledWith('Checkout', {
      timestamp: '2026-05-29T12:00:00.000Z',
    });
  });

  it('uses the EU PostHog host when app config omits a host override', async () => {
    mockExpoConfigExtra = {
      posthogApiKey: 'ph_test',
      posthogHost: undefined,
      merchantId: 'merchant-1',
      merchantSlug: 'ogabassey',
      merchantDomain: 'ogabassey.com',
    };

    const { initAnalytics } = await import('./analytics-core');
    const PostHog = (await import('posthog-react-native')).default;

    await initAnalytics();

    expect(PostHog).toHaveBeenCalledWith(
      'ph_test',
      expect.objectContaining({ host: 'https://eu.i.posthog.com' })
    );
  });

  it('supports identity, feature flags, and shutdown', async () => {
    const {
      initAnalytics,
      getFeatureFlagValue,
      identifyUser,
      isFeatureEnabled,
      resetUser,
      shutdownAnalytics,
    } = await import('./analytics-core');

    mockIsFeatureEnabled.mockResolvedValue(true);
    mockGetFeatureFlag.mockResolvedValue('variant-a');

    await initAnalytics();
    identifyUser('user-1', { email: 'buyer@example.com' });
    resetUser();

    await expect(isFeatureEnabled('new-checkout')).resolves.toBe(true);
    await expect(getFeatureFlagValue('banner-copy')).resolves.toBe('variant-a');
    await shutdownAnalytics();

    expect(mockIdentify).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ email: 'buyer@example.com' })
    );
    expect(mockReset).toHaveBeenCalled();
    expect(mockRegister).toHaveBeenCalledTimes(2);
    expect(mockRegister).toHaveBeenNthCalledWith(2, {
      app_surface: 'mobile-storefront',
      merchant_id: 'merchant-1',
      merchant_slug: 'ogabassey',
      merchant_domain: 'ogabassey.com',
    });
    expect(mockFlush).toHaveBeenCalled();
    expect(mockShutdown).toHaveBeenCalled();
  });

  it('enables exception autocapture and forwards manual exceptions', async () => {
    const { initAnalytics, captureException } = await import(
      './analytics-core'
    );
    const PostHog = (await import('posthog-react-native')).default;

    await initAnalytics();
    const error = new Error('checkout failed');
    captureException(error, { merchantId: 'merchant-1' });

    expect(PostHog).toHaveBeenCalledWith(
      'ph_test',
      expect.objectContaining({
        errorTracking: {
          autocapture: expect.objectContaining({
            uncaughtExceptions: true,
            unhandledRejections: true,
            nativeCrashes: true,
          }),
        },
      })
    );
    expect(mockCaptureException).toHaveBeenCalledWith(error, {
      merchantId: 'merchant-1',
    });
  });

  it('captureException is a no-op before initialization', async () => {
    jest.resetModules();
    const { captureException } = await import('./analytics-core');

    expect(() => captureException(new Error('too early'))).not.toThrow();
    expect(mockCaptureException).not.toHaveBeenCalled();
  });
});
