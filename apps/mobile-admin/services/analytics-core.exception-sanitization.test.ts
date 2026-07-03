import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  captureException: vi.fn(),
  expoConfigExtra: {
    posthogApiKey: 'ph_test',
    posthogHost: 'https://posthog.example.com',
  },
  register: vi.fn(),
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
      register: mocks.register,
    };
  }),
}));

async function importInitializedAnalyticsCore() {
  vi.resetModules();
  const core = await import('./analytics-core');
  core.initAdminAnalytics();
  return core;
}

describe('admin analytics exception sanitization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sanitizes cyclic exception causes without overflowing the stack', async () => {
    const { captureAdminException } = await importInitializedAnalyticsCore();
    const error = new Error('cyclic failure') as Error & { cause?: unknown };
    error.cause = error;

    expect(captureAdminException(error)).toBe(true);

    const [capturedError] = mocks.captureException.mock.calls[0] as [
      Error & { cause?: unknown },
      Record<string, unknown>,
    ];
    expect(capturedError.message).toBe('cyclic failure');
    expect(capturedError.cause).toBe('[Circular]');
  });

  it('sanitizes thrown object payloads before capture', async () => {
    const { captureAdminException } = await importInitializedAnalyticsCore();

    expect(
      captureAdminException({
        config: {
          headers: { authorization: 'Bearer secret-token' },
          url: 'https://api.usebaci.com/orders?token=secret',
        },
        credentials: new Error('Bearer secret owner@example.com'),
        errors: [
          new Error('Customer email owner@example.com'),
          'Receiver phone +234 800 000 0000',
        ],
      })
    ).toBe(true);

    const [capturedPayload] = mocks.captureException.mock.calls[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(capturedPayload).toEqual({
      config: {
        headers: { authorization: '[Filtered]' },
        url: 'https://api.usebaci.com/orders',
      },
      credentials: '[Filtered]',
      errors: [
        expect.objectContaining({
          message: 'Customer email [Filtered]',
          name: 'Error',
        }),
        'Receiver phone [Filtered]',
      ],
    });
  });

  it('does not throw when telemetry capture itself fails', async () => {
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const { captureAdminException } = await importInitializedAnalyticsCore();

    mocks.captureException.mockImplementationOnce(() => {
      throw new Error('posthog unavailable');
    });

    expect(captureAdminException(new Error('render failed'))).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      '[PostHog] Failed to capture mobile-admin exception:',
      expect.any(Error)
    );

    warnSpy.mockRestore();
  });
});
