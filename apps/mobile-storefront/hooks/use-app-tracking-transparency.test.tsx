import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { useAppTrackingTransparency } from './use-app-tracking-transparency';

const mockCanRequestTrackingTransparency = jest.fn<() => boolean>(() => true);
const mockGetTrackingPermissionStatus =
  jest.fn<() => Promise<{ status: string }>>();
const mockRequestTrackingPermission = jest.fn<() => Promise<string>>();
const mockRecordCrashBreadcrumb = jest.fn();
const mockTrackEvent = jest.fn();
const mockRemoveAppStateListener = jest.fn();
let mockAppState: AppStateStatus = 'active';
let mockAppStateListener: ((state: AppStateStatus) => void) | null = null;

jest.mock('@/lib/tracking-transparency', () => ({
  canRequestTrackingTransparency: () => mockCanRequestTrackingTransparency(),
  getTrackingPermissionStatus: () => mockGetTrackingPermissionStatus(),
}));

jest.mock('@/services/ad-tracking', () => ({
  requestTrackingPermission: () => mockRequestTrackingPermission(),
}));

jest.mock('@/lib/crash-diagnostics', () => ({
  recordCrashBreadcrumb: (...args: unknown[]) =>
    mockRecordCrashBreadcrumb(...args),
}));

jest.mock('@/services/analytics', () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

describe('useAppTrackingTransparency', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAppState = 'active';
    mockAppStateListener = null;
    mockCanRequestTrackingTransparency.mockReturnValue(true);
    mockGetTrackingPermissionStatus.mockResolvedValue({
      status: 'undetermined',
    });
    mockRequestTrackingPermission.mockResolvedValue('granted');
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      get: () => mockAppState,
    });
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_type, listener) => {
        mockAppStateListener = listener;
        return { remove: mockRemoveAppStateListener };
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('requests ATT from the root lifecycle after visible UI enables it', async () => {
    const { result, rerender } = renderHook<
      ReturnType<typeof useAppTrackingTransparency>,
      { enabled: boolean }
    >(({ enabled }) => useAppTrackingTransparency({ enabled }), {
      initialProps: { enabled: false },
    });

    expect(result.current.isTrackingAuthorizationSettled).toBe(false);
    expect(mockGetTrackingPermissionStatus).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await waitFor(() => {
      expect(mockRequestTrackingPermission).toHaveBeenCalledTimes(1);
    });
    expect(result.current.isTrackingAuthorizationSettled).toBe(true);
    expect(mockRecordCrashBreadcrumb).toHaveBeenCalledWith(
      'att:status_checked',
      { status: 'undetermined' }
    );
    expect(mockTrackEvent).toHaveBeenCalledWith('ATT Request Result', {
      status: 'granted',
    });
  });

  it('settles without requesting again when ATT already has a decision', async () => {
    mockGetTrackingPermissionStatus.mockResolvedValueOnce({ status: 'denied' });

    const { result } = renderHook(() =>
      useAppTrackingTransparency({ enabled: true })
    );

    await waitFor(() => {
      expect(result.current.isTrackingAuthorizationSettled).toBe(true);
    });
    expect(mockRequestTrackingPermission).not.toHaveBeenCalled();
    expect(mockTrackEvent).toHaveBeenCalledWith('ATT Status Checked', {
      status: 'denied',
    });
  });

  it('waits for the app to become active before presenting ATT', async () => {
    mockAppState = 'background';

    const { result } = renderHook(() =>
      useAppTrackingTransparency({ enabled: true })
    );

    await waitFor(() => {
      expect(mockGetTrackingPermissionStatus).toHaveBeenCalledTimes(1);
    });
    expect(mockRequestTrackingPermission).not.toHaveBeenCalled();
    expect(mockAppStateListener).not.toBeNull();

    mockAppState = 'active';
    await act(async () => {
      mockAppStateListener?.('active');
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.isTrackingAuthorizationSettled).toBe(true);
    });
    expect(mockRemoveAppStateListener).toHaveBeenCalledTimes(1);
    expect(mockRequestTrackingPermission).toHaveBeenCalledTimes(1);
  });

  it('is already settled on platforms without ATT', () => {
    mockCanRequestTrackingTransparency.mockReturnValue(false);

    const { result } = renderHook(() =>
      useAppTrackingTransparency({ enabled: true })
    );

    expect(result.current.isTrackingAuthorizationSettled).toBe(true);
    expect(mockGetTrackingPermissionStatus).not.toHaveBeenCalled();
    expect(mockRequestTrackingPermission).not.toHaveBeenCalled();
  });

  it('fails closed and settles when the ATT status cannot be read', async () => {
    mockGetTrackingPermissionStatus.mockRejectedValueOnce(
      new Error('ATT status unavailable')
    );

    const { result } = renderHook(() =>
      useAppTrackingTransparency({ enabled: true })
    );

    await waitFor(() => {
      expect(result.current.isTrackingAuthorizationSettled).toBe(true);
    });
    expect(mockRequestTrackingPermission).not.toHaveBeenCalled();
    expect(mockTrackEvent).toHaveBeenCalledWith('ATT Request Error', {
      stage: 'status',
    });
  });

  it('fails closed and settles when the native ATT request rejects', async () => {
    mockRequestTrackingPermission.mockRejectedValueOnce(
      new Error('ATT request unavailable')
    );

    const { result } = renderHook(() =>
      useAppTrackingTransparency({ enabled: true })
    );

    await waitFor(() => {
      expect(result.current.isTrackingAuthorizationSettled).toBe(true);
    });
    expect(mockRequestTrackingPermission).toHaveBeenCalledTimes(1);
    expect(mockRecordCrashBreadcrumb).toHaveBeenCalledWith(
      'att:request_error',
      { stage: 'request' }
    );
  });

  it('removes a pending active-state listener when the root unmounts', async () => {
    mockAppState = 'background';
    const { unmount } = renderHook(() =>
      useAppTrackingTransparency({ enabled: true })
    );

    await waitFor(() => {
      expect(mockAppStateListener).not.toBeNull();
    });
    unmount();

    expect(mockRemoveAppStateListener).toHaveBeenCalledTimes(1);
    expect(mockRequestTrackingPermission).not.toHaveBeenCalled();
  });

  it('restarts an interrupted ATT flow when root enablement returns', async () => {
    let resolveFirstStatus: ((value: { status: string }) => void) | undefined;
    mockGetTrackingPermissionStatus
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirstStatus = resolve;
          })
      )
      .mockResolvedValueOnce({ status: 'undetermined' });

    const { result, rerender } = renderHook<
      ReturnType<typeof useAppTrackingTransparency>,
      { enabled: boolean }
    >(({ enabled }) => useAppTrackingTransparency({ enabled }), {
      initialProps: { enabled: true },
    });

    await waitFor(() => {
      expect(mockGetTrackingPermissionStatus).toHaveBeenCalledTimes(1);
    });
    rerender({ enabled: false });
    rerender({ enabled: true });

    await waitFor(() => {
      expect(mockGetTrackingPermissionStatus).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(result.current.isTrackingAuthorizationSettled).toBe(true);
    });
    expect(mockRequestTrackingPermission).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirstStatus?.({ status: 'undetermined' });
      await Promise.resolve();
    });
    expect(mockRequestTrackingPermission).toHaveBeenCalledTimes(1);
  });
});
