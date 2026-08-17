import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { PreviousProcessExit } from '@/lib/anr-telemetry';

const mockInit = jest.fn();
const mockSetContext = jest.fn();
const mockSetTag = jest.fn();
const mockAddBreadcrumb = jest.fn();
const mockCaptureMessage = jest.fn();
const mockTrackEvent = jest.fn();
const mockGetPreviousProcessExit =
  jest.fn<() => Promise<PreviousProcessExit | null>>();
const mockAcknowledgePreviousProcessExit = jest.fn();

jest.mock('@sentry/react-native', () => ({
  addBreadcrumb: mockAddBreadcrumb,
  captureMessage: mockCaptureMessage,
  init: mockInit,
  setContext: mockSetContext,
  setTag: mockSetTag,
}));

jest.mock('@/lib/anr-telemetry', () => ({
  acknowledgePreviousProcessExit: mockAcknowledgePreviousProcessExit,
  getPreviousProcessExit: mockGetPreviousProcessExit,
}));

jest.mock('./analytics', () => ({ trackEvent: mockTrackEvent }));

describe('initializeErrorMonitoring', () => {
  beforeEach(() => {
    jest.resetModules();
    mockInit.mockClear();
    mockSetContext.mockClear();
    mockSetTag.mockClear();
    mockAddBreadcrumb.mockClear();
    mockCaptureMessage.mockClear();
    mockTrackEvent.mockClear();
    mockGetPreviousProcessExit.mockResolvedValue(null);
    mockAcknowledgePreviousProcessExit.mockClear();
  });

  it('initializes native ANR and crash capture without collecting PII', () => {
    const { initializeErrorMonitoring } =
      jest.requireActual<typeof import('./error-monitoring')>(
        './error-monitoring'
      );

    expect(
      initializeErrorMonitoring({
        EXPO_PUBLIC_SENTRY_DSN: ' https://public@example.invalid/1 ',
        EXPO_PUBLIC_SENTRY_ENVIRONMENT: ' production ',
      })
    ).toBe(true);
    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({
        attachScreenshot: false,
        attachThreads: true,
        dsn: 'https://public@example.invalid/1',
        enableAnrFingerprinting: true,
        enableHistoricalTombstoneReporting: true,
        enableNative: true,
        enableNativeCrashHandling: true,
        enableTombstone: true,
        environment: 'production',
        sendDefaultPii: false,
        tracesSampleRate: 0,
      })
    );
    expect(mockInit.mock.calls[0]?.[0]).not.toHaveProperty(
      'autoInitializeNativeSdk'
    );
  });

  it('stays disabled when the public DSN is missing', () => {
    const { initializeErrorMonitoring } =
      jest.requireActual<typeof import('./error-monitoring')>(
        './error-monitoring'
      );

    expect(initializeErrorMonitoring({})).toBe(false);
    expect(mockInit).not.toHaveBeenCalled();
  });

  it('initializes from the bundled Expo public environment', () => {
    const previousDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
    const previousEnvironment = process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT;
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://bundled@example.invalid/2';
    process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT = 'preview';

    try {
      jest.resetModules();
      const { initializeErrorMonitoring } =
        jest.requireActual<typeof import('./error-monitoring')>(
          './error-monitoring'
        );

      expect(initializeErrorMonitoring()).toBe(true);
      expect(mockInit).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn: 'https://bundled@example.invalid/2',
          environment: 'preview',
        })
      );
    } finally {
      if (previousDsn === undefined) {
        delete process.env.EXPO_PUBLIC_SENTRY_DSN;
      } else {
        process.env.EXPO_PUBLIC_SENTRY_DSN = previousDsn;
      }
      if (previousEnvironment === undefined) {
        delete process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT;
      } else {
        process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT = previousEnvironment;
      }
    }
  });

  it('initializes at most once per application process', () => {
    const { initializeErrorMonitoring } =
      jest.requireActual<typeof import('./error-monitoring')>(
        './error-monitoring'
      );
    const env = { EXPO_PUBLIC_SENTRY_DSN: 'https://public@example.invalid/1' };

    expect(initializeErrorMonitoring(env)).toBe(true);
    expect(initializeErrorMonitoring(env)).toBe(false);
    expect(mockInit).toHaveBeenCalledTimes(1);
  });

  it('reports an unacknowledged ANR with the persisted surface context', async () => {
    mockGetPreviousProcessExit.mockResolvedValueOnce({
      importance: 100,
      pid: 321,
      processStateSummary:
        'baci-anr-v1|surface=gadget_pattern|instance=gadget_pattern_1|focused=1|ts=1234',
      reason: 'ANR',
      reasonCode: 6,
      timestamp: 1234,
      traceAvailable: true,
    });

    const { reportPreviousProcessExit } =
      jest.requireActual<typeof import('./error-monitoring')>(
        './error-monitoring'
      );

    await reportPreviousProcessExit();

    expect(mockSetContext).toHaveBeenCalledWith(
      'previous_process_exit',
      expect.objectContaining({
        process_state_summary: expect.stringContaining(
          'surface=gadget_pattern'
        ),
        reason: 'ANR',
        trace_available: true,
      })
    );
    expect(mockSetTag).toHaveBeenCalledWith(
      'previous_exit_surface',
      'gadget_pattern'
    );
    expect(mockCaptureMessage).toHaveBeenCalledWith(
      'previous_process_exit:ANR',
      'warning'
    );
    expect(mockTrackEvent).toHaveBeenCalledWith(
      'previous_process_exit',
      expect.objectContaining({ reason: 'ANR', timestamp: 1234 })
    );
    expect(mockAcknowledgePreviousProcessExit).toHaveBeenCalledWith(1234);
  });

  it('acknowledges the exit even when a telemetry backend throws', async () => {
    mockGetPreviousProcessExit.mockResolvedValueOnce({
      reason: 'ANR',
      timestamp: 5678,
    });
    mockSetContext.mockImplementationOnce(() => {
      throw new Error('Sentry unavailable');
    });

    const { reportPreviousProcessExit } =
      jest.requireActual<typeof import('./error-monitoring')>(
        './error-monitoring'
      );

    await expect(reportPreviousProcessExit()).resolves.toBeUndefined();
    expect(mockAcknowledgePreviousProcessExit).toHaveBeenCalledWith(5678);
  });
});
