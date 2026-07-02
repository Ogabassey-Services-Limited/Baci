import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';

const mockNotificationsModuleLoad = jest.fn();
const mockGetPermissionsAsync = jest
  .fn<() => Promise<{ status: string }>>()
  .mockResolvedValue({ status: 'granted' });
const mockRequestPermissionsAsync = jest
  .fn<() => Promise<{ status: string }>>()
  .mockResolvedValue({ status: 'granted' });
const mockGetTrackingPermissionsAsync = jest
  .fn<() => Promise<{ status: string }>>()
  .mockResolvedValue({ status: 'undetermined' });
const mockRequestTrackingPermissionsAsync = jest
  .fn<() => Promise<{ status: string }>>()
  .mockResolvedValue({ status: 'granted' });
let mockRejectNextNotificationsModuleLoad = false;
const originalPlatformOS = Platform.OS;
let mockPlatformOS = originalPlatformOS;

jest.mock('expo-notifications', () => {
  mockNotificationsModuleLoad();
  if (mockRejectNextNotificationsModuleLoad) {
    mockRejectNextNotificationsModuleLoad = false;
    throw new Error('notification module unavailable');
  }
  return {
    getPermissionsAsync: mockGetPermissionsAsync,
    requestPermissionsAsync: mockRequestPermissionsAsync,
  };
});

jest.mock('@/lib/tracking-transparency', () => ({
  canRequestTrackingTransparency: () => mockPlatformOS === 'ios',
  getTrackingPermissionStatus: () => mockGetTrackingPermissionsAsync(),
  requestTrackingPermissionStatus: () => mockRequestTrackingPermissionsAsync(),
}));

function setPlatformOS(value: typeof Platform.OS) {
  mockPlatformOS = value;
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRejectNextNotificationsModuleLoad = false;
  mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
  mockRequestPermissionsAsync.mockResolvedValue({ status: 'granted' });
  mockGetTrackingPermissionsAsync.mockResolvedValue({
    status: 'undetermined',
  });
  mockRequestTrackingPermissionsAsync.mockResolvedValue({
    status: 'granted',
  });
  jest.useRealTimers();
  setPlatformOS(originalPlatformOS);
});

afterEach(() => {
  jest.useRealTimers();
  setPlatformOS(originalPlatformOS);
});

describe('usePermissionBooster native module loading', () => {
  it('does not load expo-notifications on module initialization', async () => {
    await import('./use-permission-booster');

    expect(mockNotificationsModuleLoad).not.toHaveBeenCalled();
  });

  it('loads expo-notifications on demand and retries after an import failure', async () => {
    mockRejectNextNotificationsModuleLoad = true;
    const { usePermissionBooster } = await import('./use-permission-booster');
    const { result } = renderHook(() => usePermissionBooster());
    let permissionResult: 'granted' | 'denied' | 'soft-ask-needed' | undefined;

    expect(mockNotificationsModuleLoad).not.toHaveBeenCalled();

    await expect(
      result.current.requestPermission('notifications')
    ).rejects.toThrow('notification module unavailable');

    await act(async () => {
      permissionResult =
        await result.current.requestPermission('notifications');
    });

    expect(permissionResult).toBe('granted');
    expect(mockNotificationsModuleLoad).toHaveBeenCalledTimes(2);
    expect(mockGetPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('returns null instead of throwing when notification permission APIs are unavailable', async () => {
    const warnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const { getNotificationPermissionStatus } = await import(
      './use-permission-booster'
    );

    await expect(getNotificationPermissionStatus({})).resolves.toBeNull();
    expect(mockGetPermissionsAsync).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      'Notification permission API unavailable: getPermissionsAsync'
    );
  });

  it('returns false instead of throwing when notification request APIs are unavailable', async () => {
    const warnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const { requestNotificationPermissionStatus } = await import(
      './use-permission-booster'
    );

    await expect(requestNotificationPermissionStatus({})).resolves.toBe(false);
    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      'Notification permission API unavailable: requestPermissionsAsync'
    );
  });
});

describe('usePermissionBooster tracking permissions', () => {
  it('does not trigger the iOS tracking system prompt during soft-ask status checks', async () => {
    setPlatformOS('ios');
    const { usePermissionBooster } = await import('./use-permission-booster');
    const { result } = renderHook(() => usePermissionBooster());

    let permissionResult: 'granted' | 'denied' | 'soft-ask-needed' | undefined;
    await act(async () => {
      permissionResult = await result.current.requestPermission('tracking');
    });

    expect(permissionResult).toBe('soft-ask-needed');
    expect(mockGetTrackingPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(mockRequestTrackingPermissionsAsync).not.toHaveBeenCalled();
  });

  it('returns granted when iOS tracking permission is already granted', async () => {
    setPlatformOS('ios');
    mockGetTrackingPermissionsAsync.mockResolvedValueOnce({
      status: 'granted',
    });
    const { usePermissionBooster } = await import('./use-permission-booster');
    const { result } = renderHook(() => usePermissionBooster());

    let permissionResult: 'granted' | 'denied' | 'soft-ask-needed' | undefined;
    await act(async () => {
      permissionResult = await result.current.requestPermission('tracking');
    });

    expect(permissionResult).toBe('granted');
    expect(mockGetTrackingPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(mockRequestTrackingPermissionsAsync).not.toHaveBeenCalled();
  });

  it('returns denied during the tracking soft-ask cool-down without showing the system prompt', async () => {
    setPlatformOS('ios');
    mockGetTrackingPermissionsAsync.mockResolvedValueOnce({
      status: 'denied',
    });
    const { usePermissionBooster } = await import('./use-permission-booster');
    const { result } = renderHook(() => usePermissionBooster());

    act(() => {
      result.current.reset();
      result.current.markDenied('tracking');
    });

    let permissionResult: 'granted' | 'denied' | 'soft-ask-needed' | undefined;
    await act(async () => {
      permissionResult = await result.current.requestPermission('tracking');
    });

    expect(permissionResult).toBe('denied');
    expect(mockGetTrackingPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(mockRequestTrackingPermissionsAsync).not.toHaveBeenCalled();
  });

  it('returns soft-ask-needed after the tracking soft-ask cool-down elapses without showing the system prompt', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    setPlatformOS('ios');
    mockGetTrackingPermissionsAsync.mockResolvedValueOnce({
      status: 'denied',
    });
    const { PERMISSION_SOFT_ASK_COOLDOWN_MS, usePermissionBooster } =
      await import('./use-permission-booster');
    const { result } = renderHook(() => usePermissionBooster());

    act(() => {
      result.current.reset();
      result.current.markDenied('tracking');
    });
    jest.setSystemTime(Date.now() + PERMISSION_SOFT_ASK_COOLDOWN_MS + 1);

    let permissionResult: 'granted' | 'denied' | 'soft-ask-needed' | undefined;
    await act(async () => {
      permissionResult = await result.current.requestPermission('tracking');
    });

    expect(permissionResult).toBe('soft-ask-needed');
    expect(mockGetTrackingPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(mockRequestTrackingPermissionsAsync).not.toHaveBeenCalled();
  });

  it('returns granted outside iOS without loading the tracking transparency module', async () => {
    setPlatformOS('android');
    const { usePermissionBooster } = await import('./use-permission-booster');
    const { result } = renderHook(() => usePermissionBooster());

    let permissionResult: 'granted' | 'denied' | 'soft-ask-needed' | undefined;
    await act(async () => {
      permissionResult = await result.current.requestPermission('tracking');
    });

    expect(permissionResult).toBe('granted');
    expect(mockGetTrackingPermissionsAsync).not.toHaveBeenCalled();
    expect(mockRequestTrackingPermissionsAsync).not.toHaveBeenCalled();
  });

  it('returns denied when the iOS tracking status check fails', async () => {
    setPlatformOS('ios');
    mockGetTrackingPermissionsAsync.mockRejectedValueOnce(
      new Error('tracking status unavailable')
    );
    const { usePermissionBooster } = await import('./use-permission-booster');
    const { result } = renderHook(() => usePermissionBooster());

    let permissionResult: 'granted' | 'denied' | 'soft-ask-needed' | undefined;
    await act(async () => {
      permissionResult = await result.current.requestPermission('tracking');
    });

    expect(permissionResult).toBe('denied');
    expect(mockGetTrackingPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(mockRequestTrackingPermissionsAsync).not.toHaveBeenCalled();
  });

  it('handles unexpected iOS tracking statuses as soft-ask candidates', async () => {
    setPlatformOS('ios');
    mockGetTrackingPermissionsAsync.mockResolvedValueOnce({
      status: 'restricted',
    });
    const { usePermissionBooster } = await import('./use-permission-booster');
    const { result } = renderHook(() => usePermissionBooster());

    act(() => {
      result.current.reset();
    });

    let permissionResult: 'granted' | 'denied' | 'soft-ask-needed' | undefined;
    await act(async () => {
      permissionResult = await result.current.requestPermission('tracking');
    });

    expect(permissionResult).toBe('soft-ask-needed');
    expect(mockGetTrackingPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(mockRequestTrackingPermissionsAsync).not.toHaveBeenCalled();
  });
});
