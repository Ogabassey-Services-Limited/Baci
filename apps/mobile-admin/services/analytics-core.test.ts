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

async function importInitializedAnalyticsCore() {
  const core = await importAnalyticsCore();
  core.initAdminAnalytics();
  return core;
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
      $set: {
        merchant_id: '6b5cb8a4-5575-456c-b936-8cdfae30db74',
        merchant_is_published: true,
        plan_tier: 'business',
      },
      $set_once: {
        first_seen: '2026-07-02T12:00:00.000Z',
      },
    });
  });

  it('captures handled exceptions after sanitizing context', async () => {
    const { captureAdminException } = await importInitializedAnalyticsCore();
    const error = new Error('render failed');

    expect(
      captureAdminException(error, {
        component_stack: 'OwnerEmail(owner@example.com)',
        requestUrl: 'https://usebaci.com/dashboard?token=secret',
        merchant_id: 'merchant-1',
      })
    ).toBe(true);

    const [capturedError, capturedProperties] = mocks.captureException.mock
      .calls[0] as [Error, Record<string, unknown>];
    expect(capturedError.message).toBe('render failed');
    expect(capturedProperties).toEqual({
      app_surface: 'mobile-admin',
      component_stack: 'OwnerEmail([Filtered])',
      merchant_id: 'merchant-1',
      requestUrl: 'https://usebaci.com/dashboard',
    });
  });

  it('sanitizes exception message, stack, and cause before capture', async () => {
    const { captureAdminException } = await importInitializedAnalyticsCore();
    const error = new Error(
      'Failed https://api.usebaci.com/orders?token=secret for owner@example.com'
    ) as Error & { cause?: unknown };
    error.name = 'OwnerEmail owner@example.com';
    error.stack =
      'OwnerEmail owner@example.com\n    at https://api.usebaci.com/orders?token=secret#x';
    error.cause = new Error('Receiver phone +234 800 000 0000');

    expect(captureAdminException(error)).toBe(true);

    const [capturedError] = mocks.captureException.mock.calls[0] as [
      Error & { cause?: Error },
      Record<string, unknown>,
    ];
    expect(capturedError.message).toBe(
      'Failed https://api.usebaci.com/orders for [Filtered]'
    );
    expect(capturedError.name).toBe('OwnerEmail [Filtered]');
    expect(capturedError.stack).toBe(
      'OwnerEmail [Filtered]\n    at https://api.usebaci.com/orders'
    );
    expect(capturedError.cause?.message).toBe('Receiver phone [Filtered]');
  });

  it('lazily initializes before capturing the first boundary exception', async () => {
    const { captureAdminException } = await importAnalyticsCore();
    const PostHog = (await import('posthog-react-native')).default;
    const error = new Error('first render failure');

    expect(
      captureAdminException(error, { route_surface: 'mobile-admin' })
    ).toBe(true);

    expect(PostHog).toHaveBeenCalledTimes(1);
    const [capturedError, capturedProperties] = mocks.captureException.mock
      .calls[0] as [Error, Record<string, unknown>];
    expect(capturedError.message).toBe('first render failure');
    expect(capturedProperties).toEqual({
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
