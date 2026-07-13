import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Camera, PermissionStatus } from 'expo-camera';
import { AppState, type AppStateStatus } from 'react-native';
import { useCameraPermission } from './use-camera-permission';

jest.mock('expo-camera', () => ({
  Camera: {
    getCameraPermissionsAsync: jest.fn(),
    requestCameraPermissionsAsync: jest.fn(),
  },
  PermissionStatus: {
    DENIED: 'denied',
    GRANTED: 'granted',
    UNDETERMINED: 'undetermined',
  },
}));

const getCameraPermissionsAsyncMock = jest.mocked(
  Camera.getCameraPermissionsAsync
);
const requestCameraPermissionsAsyncMock = jest.mocked(
  Camera.requestCameraPermissionsAsync
);
let appStateChangeHandler: ((state: AppStateStatus) => void) | undefined;

function buildCameraPermissionResponse(granted: boolean, canAskAgain = true) {
  return {
    canAskAgain,
    expires: 'never',
    granted,
    status: granted ? PermissionStatus.GRANTED : PermissionStatus.DENIED,
  } satisfies Awaited<ReturnType<typeof Camera.requestCameraPermissionsAsync>>;
}

describe('useCameraPermission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    appStateChangeHandler = undefined;
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_eventType, listener) => {
        appStateChangeHandler = listener as (state: AppStateStatus) => void;
        return { remove: jest.fn() } as ReturnType<
          typeof AppState.addEventListener
        >;
      });
    getCameraPermissionsAsyncMock.mockResolvedValue(
      buildCameraPermissionResponse(true)
    );
    requestCameraPermissionsAsyncMock.mockResolvedValue(
      buildCameraPermissionResponse(true)
    );
  });

  it('does not request camera permission when disabled', () => {
    const { result } = renderHook(() => useCameraPermission(false));

    expect(result.current.canAskAgain).toBe(true);
    expect(result.current.status).toBe('granted');
    expect(requestCameraPermissionsAsyncMock).not.toHaveBeenCalled();
  });

  it('requests camera permission when enabled', async () => {
    const { result } = renderHook(() => useCameraPermission(true));

    expect(result.current.status).toBe('checking');
    await waitFor(() => expect(result.current.status).toBe('granted'));
    expect(result.current.canAskAgain).toBe(true);
    expect(requestCameraPermissionsAsyncMock).toHaveBeenCalledTimes(1);
  });

  it('exposes permanent camera permission denial state', async () => {
    requestCameraPermissionsAsyncMock.mockResolvedValueOnce(
      buildCameraPermissionResponse(false, false)
    );

    const { result } = renderHook(() => useCameraPermission(true));

    await waitFor(() => expect(result.current.status).toBe('denied'));
    expect(result.current.canAskAgain).toBe(false);
  });

  it('refreshes permanently denied camera permission after returning from settings', async () => {
    requestCameraPermissionsAsyncMock.mockResolvedValueOnce(
      buildCameraPermissionResponse(false, false)
    );
    getCameraPermissionsAsyncMock.mockResolvedValueOnce(
      buildCameraPermissionResponse(true)
    );

    const { result } = renderHook(() => useCameraPermission(true));

    await waitFor(() => expect(result.current.status).toBe('denied'));
    expect(result.current.canAskAgain).toBe(false);

    act(() => {
      appStateChangeHandler?.('background');
    });

    expect(getCameraPermissionsAsyncMock).not.toHaveBeenCalled();

    act(() => {
      appStateChangeHandler?.('active');
    });

    await waitFor(() => expect(result.current.status).toBe('granted'));
    expect(result.current.canAskAgain).toBe(true);
    expect(getCameraPermissionsAsyncMock).toHaveBeenCalledTimes(1);
  });

  it('retries denied camera permission requests', async () => {
    requestCameraPermissionsAsyncMock
      .mockResolvedValueOnce(buildCameraPermissionResponse(false))
      .mockResolvedValueOnce(buildCameraPermissionResponse(true));

    const { result } = renderHook(() => useCameraPermission(true));

    await waitFor(() => expect(result.current.status).toBe('denied'));

    act(() => {
      result.current.retry();
    });

    expect(result.current.status).toBe('checking');
    await waitFor(() => expect(result.current.status).toBe('granted'));
    expect(requestCameraPermissionsAsyncMock).toHaveBeenCalledTimes(2);
  });

  it('treats request failures as denied permission', async () => {
    const consoleWarnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    requestCameraPermissionsAsyncMock.mockRejectedValueOnce(new Error('boom'));

    const { result } = renderHook(() => useCameraPermission(true));

    await waitFor(() => expect(result.current.status).toBe('denied'));
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[BNPLCheckout] Camera permission request failed',
      { message: 'boom' }
    );

    consoleWarnSpy.mockRestore();
  });
});
