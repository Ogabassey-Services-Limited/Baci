import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { useHomePermissionPrompt } from './useHomePermissionPrompt';

const mockCanRequestTrackingTransparency = jest.fn<() => boolean>(() => true);
const mockGetTrackingPermissionStatus = jest.fn<
  () => Promise<{ status: string }>
>();
const mockRequestTrackingPermission = jest.fn<() => Promise<string>>();
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

async function advanceHomePromptTimer() {
  await act(async () => {
    jest.advanceTimersByTime(3000);
    await Promise.resolve();
  });
}

describe('useHomePermissionPrompt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
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
    jest.useRealTimers();
  });

  it('requests the Apple ATT prompt directly when status is undetermined', async () => {
    renderHook(() => useHomePermissionPrompt());

    await advanceHomePromptTimer();

    expect(mockGetTrackingPermissionStatus).toHaveBeenCalledTimes(1);
    expect(mockRequestTrackingPermission).toHaveBeenCalledTimes(1);
  });

  it('does not request ATT again after the system status is resolved', async () => {
    mockGetTrackingPermissionStatus.mockResolvedValueOnce({ status: 'denied' });
    renderHook(() => useHomePermissionPrompt());

    await advanceHomePromptTimer();

    expect(mockGetTrackingPermissionStatus).toHaveBeenCalledTimes(1);
    expect(mockRequestTrackingPermission).not.toHaveBeenCalled();
  });

  it('waits until the app is active before requesting ATT', async () => {
    mockAppState = 'background';
    renderHook(() => useHomePermissionPrompt());

    await advanceHomePromptTimer();

    expect(mockGetTrackingPermissionStatus).not.toHaveBeenCalled();
    expect(mockAppStateListener).not.toBeNull();

    mockAppState = 'active';
    await act(async () => {
      mockAppStateListener?.('active');
      await Promise.resolve();
    });

    expect(mockRemoveAppStateListener).toHaveBeenCalledTimes(1);
    expect(mockRequestTrackingPermission).toHaveBeenCalledTimes(1);
  });

  it('does nothing on platforms without App Tracking Transparency', async () => {
    mockCanRequestTrackingTransparency.mockReturnValue(false);
    renderHook(() => useHomePermissionPrompt());

    await advanceHomePromptTimer();

    expect(mockGetTrackingPermissionStatus).not.toHaveBeenCalled();
    expect(mockRequestTrackingPermission).not.toHaveBeenCalled();
  });

  it('clears the pending native prompt timer on unmount', async () => {
    const { unmount } = renderHook(() => useHomePermissionPrompt());

    unmount();
    await advanceHomePromptTimer();

    expect(mockGetTrackingPermissionStatus).not.toHaveBeenCalled();
  });
});
