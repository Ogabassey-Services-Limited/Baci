import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  captureException: vi.fn(),
  flush: vi.fn().mockResolvedValue(undefined),
  identify: vi.fn(),
  register: vi.fn(),
  reset: vi.fn(),
  shutdown: vi.fn().mockResolvedValue(undefined),
  expoConfigExtra: {
    posthogApiKey: 'ph_test',
    posthogHost: 'https://posthog.example.com',
  } as { posthogApiKey?: string; posthogHost?: string },
}));

vi.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      version: '2.0.41',
      get extra() {
        return mocks.expoConfigExtra;
      },
    },
  },
}));

vi.mock('posthog-react-native', () => ({
  default: vi.fn(function PostHogMock() {
    return {
      captureException: mocks.captureException,
      flush: mocks.flush,
      identify: mocks.identify,
      register: mocks.register,
      reset: mocks.reset,
      shutdown: mocks.shutdown,
    };
  }),
}));

function importAnalyticsCore() {
  vi.resetModules();
  return import('./analytics-core');
}

describe('admin analytics core', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-02T12:00:00.000Z'));
    mocks.expoConfigExtra = {
      posthogApiKey: 'ph_test',
      posthogHost: 'https://posthog.example.com',
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes PostHog with admin-safe error tracking', async () => {
    const { initAdminAnalytics } = await importAnalyticsCore();
    const PostHog = (await import('posthog-react-native')).default;

    expect(initAdminAnalytics()).toBe(true);

    expect(PostHog).toHaveBeenCalledWith(
      'ph_test',
      expect.objectContaining({
        host: 'https://posthog.example.com',
        before_send: expect.any(Function),
        captureAppLifecycleEvents: true,
        customAppProperties: expect.any(Function),
        enableSessionReplay: false,
        errorTracking: {
          autocapture: {
            console: false,
            nativeCrashes: true,
            uncaughtExceptions: true,
            unhandledRejections: true,
          },
        },
      })
    );

    const [, options] = vi.mocked(PostHog).mock.calls[0] as [
      string,
      {
        customAppProperties: (properties: Record<string, unknown>) => unknown;
      },
    ];
    expect(options.customAppProperties({ platform: 'ios' })).toEqual({
      platform: 'ios',
      app_surface: 'mobile-admin',
      release_version: '2.0.41',
    });
    expect(mocks.register).toHaveBeenCalledWith({
      app_surface: 'mobile-admin',
      release_version: '2.0.41',
    });
  });

  it('uses the EU ingest host by default', async () => {
    mocks.expoConfigExtra = { posthogApiKey: 'ph_test' };
    const { initAdminAnalytics } = await importAnalyticsCore();
    const PostHog = (await import('posthog-react-native')).default;

    expect(initAdminAnalytics()).toBe(true);

    expect(PostHog).toHaveBeenCalledWith(
      'ph_test',
      expect.objectContaining({ host: 'https://eu.i.posthog.com' })
    );
  });

  it('does not initialize when the project token is missing', async () => {
    mocks.expoConfigExtra = { posthogApiKey: '' };
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const { initAdminAnalytics, captureAdminException } =
      await importAnalyticsCore();
    const PostHog = (await import('posthog-react-native')).default;

    expect(initAdminAnalytics()).toBe(false);
    expect(captureAdminException(new Error('not initialized'))).toBe(false);
    expect(PostHog).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('identifies users with sanitized merchant context only', async () => {
    const { identifyAdminUser, initAdminAnalytics } =
      await importAnalyticsCore();

    initAdminAnalytics();
    identifyAdminUser('user-1', {
      isPublished: true,
      merchantId: '6b5cb8a4-5575-456c-b936-8cdfae30db74',
      planTier: 'business',
    });

    expect(mocks.identify).toHaveBeenCalledWith('user-1', {
      merchant_id: '6b5cb8a4-5575-456c-b936-8cdfae30db74',
      merchant_is_published: true,
      plan_tier: 'business',
      $set_once: {
        first_seen: '2026-07-02T12:00:00.000Z',
      },
    });
  });

  it('captures handled exceptions after sanitizing context', async () => {
    const { captureAdminException, initAdminAnalytics } =
      await importAnalyticsCore();
    const error = new Error('render failed');

    initAdminAnalytics();

    expect(
      captureAdminException(error, {
        componentStack: 'OwnerEmail(owner@example.com)',
        requestUrl: 'https://usebaci.com/dashboard?token=secret',
        merchant_id: 'merchant-1',
      })
    ).toBe(true);

    expect(mocks.captureException).toHaveBeenCalledWith(error, {
      app_surface: 'mobile-admin',
      componentStack: 'OwnerEmail([Filtered])',
      merchant_id: 'merchant-1',
      requestUrl: 'https://usebaci.com/dashboard',
    });
  });

  it('lazily initializes before capturing the first boundary exception', async () => {
    const { captureAdminException } = await importAnalyticsCore();
    const PostHog = (await import('posthog-react-native')).default;
    const error = new Error('first render failure');

    expect(
      captureAdminException(error, { route_surface: 'mobile-admin' })
    ).toBe(true);

    expect(PostHog).toHaveBeenCalledTimes(1);
    expect(mocks.captureException).toHaveBeenCalledWith(error, {
      app_surface: 'mobile-admin',
      route_surface: 'mobile-admin',
    });
  });

  it('resets and shuts down the client', async () => {
    const { initAdminAnalytics, resetAdminAnalytics, shutdownAdminAnalytics } =
      await importAnalyticsCore();

    initAdminAnalytics();
    resetAdminAnalytics();
    await shutdownAdminAnalytics();

    expect(mocks.reset).toHaveBeenCalled();
    expect(mocks.register).toHaveBeenCalledTimes(2);
    expect(mocks.flush).toHaveBeenCalled();
    expect(mocks.shutdown).toHaveBeenCalled();
  });
});
