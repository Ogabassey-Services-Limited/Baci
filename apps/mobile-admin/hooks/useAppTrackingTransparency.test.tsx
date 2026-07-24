import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppTrackingTransparency } from '@/hooks/useAppTrackingTransparency';

type AppStateListener = (state: string) => void;

const mocks = vi.hoisted(() => {
  const appState = {
    currentState: 'active',
    listener: null as AppStateListener | null,
    removeListener: vi.fn(),
    addEventListener(_type: string, listener: AppStateListener) {
      appState.listener = listener;
      return { remove: appState.removeListener };
    },
  };

  return {
    appState,
    canRequestTrackingTransparency: vi.fn<() => boolean>(() => true),
    getTrackingPermissionStatus: vi.fn<() => Promise<{ status: string }>>(),
    requestTrackingPermissionStatus: vi.fn<() => Promise<{ status: string }>>(),
    posthogCapture: vi.fn(),
  };
});

vi.mock('react-native', () => ({
  AppState: mocks.appState,
}));

vi.mock('@/lib/tracking-transparency', () => ({
  canRequestTrackingTransparency: () => mocks.canRequestTrackingTransparency(),
  getTrackingPermissionStatus: () => mocks.getTrackingPermissionStatus(),
  requestTrackingPermissionStatus: () =>
    mocks.requestTrackingPermissionStatus(),
}));

vi.mock('@/services/analytics-core', () => ({
  getAdminPostHog: () => ({ capture: mocks.posthogCapture }),
}));

describe('bugfix: App Store review rejected the admin app because the native ATT prompt never appeared', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.appState.currentState = 'active';
    mocks.appState.listener = null;
    mocks.canRequestTrackingTransparency.mockReturnValue(true);
    mocks.getTrackingPermissionStatus.mockResolvedValue({
      status: 'undetermined',
    });
    mocks.requestTrackingPermissionStatus.mockResolvedValue({
      status: 'granted',
    });
  });

  it('requests the native ATT prompt on first launch once the visible UI enables it', async () => {
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useAppTrackingTransparency({ enabled }),
      { initialProps: { enabled: false } }
    );

    expect(result.current.isTrackingAuthorizationSettled).toBe(false);
    expect(mocks.getTrackingPermissionStatus).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await waitFor(() => {
      expect(mocks.requestTrackingPermissionStatus).toHaveBeenCalledTimes(1);
    });
    expect(result.current.isTrackingAuthorizationSettled).toBe(true);
    expect(mocks.posthogCapture).toHaveBeenCalledWith('ATT Status Checked', {
      status: 'undetermined',
    });
    expect(mocks.posthogCapture).toHaveBeenCalledWith('ATT Request Result', {
      status: 'granted',
    });
  });

  it('settles without requesting again when ATT already has a decision', async () => {
    mocks.getTrackingPermissionStatus.mockResolvedValueOnce({
      status: 'denied',
    });

    const { result } = renderHook(() =>
      useAppTrackingTransparency({ enabled: true })
    );

    await waitFor(() => {
      expect(result.current.isTrackingAuthorizationSettled).toBe(true);
    });
    expect(mocks.requestTrackingPermissionStatus).not.toHaveBeenCalled();
  });

  it('waits for the app to become active before presenting ATT', async () => {
    mocks.appState.currentState = 'background';

    const { result } = renderHook(() =>
      useAppTrackingTransparency({ enabled: true })
    );

    await waitFor(() => {
      expect(mocks.getTrackingPermissionStatus).toHaveBeenCalledTimes(1);
    });
    expect(mocks.requestTrackingPermissionStatus).not.toHaveBeenCalled();
    expect(mocks.appState.listener).not.toBeNull();

    mocks.appState.currentState = 'active';
    await act(async () => {
      mocks.appState.listener?.('active');
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.isTrackingAuthorizationSettled).toBe(true);
    });
    expect(mocks.appState.removeListener).toHaveBeenCalledTimes(1);
    expect(mocks.requestTrackingPermissionStatus).toHaveBeenCalledTimes(1);
  });

  it('is already settled on platforms without ATT', () => {
    mocks.canRequestTrackingTransparency.mockReturnValue(false);

    const { result } = renderHook(() =>
      useAppTrackingTransparency({ enabled: true })
    );

    expect(result.current.isTrackingAuthorizationSettled).toBe(true);
    expect(mocks.getTrackingPermissionStatus).not.toHaveBeenCalled();
    expect(mocks.requestTrackingPermissionStatus).not.toHaveBeenCalled();
  });

  it('fails closed and settles when the ATT status cannot be read', async () => {
    mocks.getTrackingPermissionStatus.mockRejectedValueOnce(
      new Error('ATT status unavailable')
    );

    const { result } = renderHook(() =>
      useAppTrackingTransparency({ enabled: true })
    );

    await waitFor(() => {
      expect(result.current.isTrackingAuthorizationSettled).toBe(true);
    });
    expect(mocks.requestTrackingPermissionStatus).not.toHaveBeenCalled();
    expect(mocks.posthogCapture).toHaveBeenCalledWith('ATT Request Error', {
      stage: 'status',
    });
  });

  it('fails closed and settles when the native ATT request rejects', async () => {
    mocks.requestTrackingPermissionStatus.mockRejectedValueOnce(
      new Error('ATT request unavailable')
    );

    const { result } = renderHook(() =>
      useAppTrackingTransparency({ enabled: true })
    );

    await waitFor(() => {
      expect(result.current.isTrackingAuthorizationSettled).toBe(true);
    });
    expect(mocks.requestTrackingPermissionStatus).toHaveBeenCalledTimes(1);
    expect(mocks.posthogCapture).toHaveBeenCalledWith('ATT Request Error', {
      stage: 'request',
    });
  });

  it('removes a pending active-state listener when the root unmounts', async () => {
    mocks.appState.currentState = 'background';
    const { unmount } = renderHook(() =>
      useAppTrackingTransparency({ enabled: true })
    );

    await waitFor(() => {
      expect(mocks.appState.listener).not.toBeNull();
    });
    unmount();

    expect(mocks.appState.removeListener).toHaveBeenCalledTimes(1);
    expect(mocks.requestTrackingPermissionStatus).not.toHaveBeenCalled();
  });

  it('restarts an interrupted ATT flow when root enablement returns', async () => {
    let resolveFirstStatus: ((value: { status: string }) => void) | undefined;
    mocks.getTrackingPermissionStatus
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirstStatus = resolve;
          })
      )
      .mockResolvedValueOnce({ status: 'undetermined' });

    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useAppTrackingTransparency({ enabled }),
      { initialProps: { enabled: true } }
    );

    await waitFor(() => {
      expect(mocks.getTrackingPermissionStatus).toHaveBeenCalledTimes(1);
    });
    rerender({ enabled: false });
    rerender({ enabled: true });

    await waitFor(() => {
      expect(mocks.getTrackingPermissionStatus).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(result.current.isTrackingAuthorizationSettled).toBe(true);
    });
    expect(mocks.requestTrackingPermissionStatus).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirstStatus?.({ status: 'undetermined' });
      await Promise.resolve();
    });
    expect(mocks.requestTrackingPermissionStatus).toHaveBeenCalledTimes(1);
  });
});
