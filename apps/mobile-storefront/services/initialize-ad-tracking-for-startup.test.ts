import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

const mockInitAdTracking = jest.fn<() => Promise<void>>();
const mockRecordCrashBreadcrumb = jest.fn();

jest.mock('./ad-tracking', () => ({
  initAdTracking: () => mockInitAdTracking(),
}));

jest.mock('@/lib/crash-diagnostics', () => ({
  recordCrashBreadcrumb: (...args: unknown[]) =>
    mockRecordCrashBreadcrumb(...args),
}));

const { initializeAdTrackingForStartup } =
  require('./initialize-ad-tracking-for-startup') as typeof import('./initialize-ad-tracking-for-startup');

describe('initializeAdTrackingForStartup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockInitAdTracking.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('records successful ad tracking initialization', async () => {
    await initializeAdTrackingForStartup();

    expect(mockRecordCrashBreadcrumb).toHaveBeenCalledWith(
      'root_layout:ad_tracking_initialized'
    );
  });

  it('records an error and resolves when initialization rejects', async () => {
    const error = new Error('ATT status failed');
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockInitAdTracking.mockRejectedValue(error);

    await expect(initializeAdTrackingForStartup()).resolves.toBeUndefined();

    expect(console.error).toHaveBeenCalledWith(
      'Ad tracking initialization error:',
      error
    );
    expect(mockRecordCrashBreadcrumb).toHaveBeenCalledWith(
      'root_layout:ad_tracking_error',
      { message: 'ATT status failed' }
    );
  });

  it('times out without leaving app startup blocked', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockInitAdTracking.mockReturnValue(new Promise(() => {}));

    const initialization = initializeAdTrackingForStartup();
    await jest.runOnlyPendingTimersAsync();

    await expect(initialization).resolves.toBeUndefined();
    expect(mockRecordCrashBreadcrumb).toHaveBeenCalledWith(
      'root_layout:ad_tracking_error',
      { message: 'Ad tracking initialization timed out' }
    );
  });
});
