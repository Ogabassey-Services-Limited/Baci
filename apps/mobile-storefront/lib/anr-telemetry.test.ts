import { beforeEach, describe, expect, it, jest } from '@jest/globals';

type TelemetryBridge = typeof import('./anr-telemetry');

const mockNativeModule = {
  acknowledgePreviousExit: jest.fn(),
  beginSurfaceTrace: jest.fn(),
  endSurfaceTrace: jest.fn(),
  getPreviousExit: jest.fn<() => Promise<unknown>>(),
  setActiveSurface: jest.fn(),
};

let telemetry: TelemetryBridge;

describe('Android ANR telemetry bridge', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.doMock('expo-modules-core', () => ({
      requireOptionalNativeModule: () => mockNativeModule,
    }));
    telemetry = jest.requireActual<TelemetryBridge>('./anr-telemetry');
  });

  it('forwards bounded surface state and trace markers to the native bridge', () => {
    telemetry.setNativeActiveSurface('home', 'home', true);
    telemetry.beginNativeSurfaceTrace('home', 'home');
    telemetry.endNativeSurfaceTrace('home', 'home');

    expect(mockNativeModule.setActiveSurface).toHaveBeenCalledWith(
      'home',
      'home',
      true
    );
    expect(mockNativeModule.beginSurfaceTrace).toHaveBeenCalledWith(
      'home',
      'home'
    );
    expect(mockNativeModule.endSurfaceTrace).toHaveBeenCalledWith(
      'home',
      'home'
    );
  });

  it('returns a previous process exit only when the native record has a timestamp', async () => {
    mockNativeModule.getPreviousExit.mockResolvedValueOnce({
      reason: 'ANR',
      timestamp: 1234,
    });

    await expect(telemetry.getPreviousProcessExit()).resolves.toEqual({
      importance: undefined,
      pid: undefined,
      processStateSummary: null,
      reason: 'ANR',
      reasonCode: undefined,
      timestamp: 1234,
      traceAvailable: false,
    });

    mockNativeModule.getPreviousExit.mockResolvedValueOnce({ reason: 'ANR' });
    await expect(telemetry.getPreviousProcessExit()).resolves.toBeNull();
  });

  it('acknowledges a reported process exit without throwing', () => {
    telemetry.acknowledgePreviousProcessExit(1234);

    expect(mockNativeModule.acknowledgePreviousExit).toHaveBeenCalledWith(1234);
  });
});
