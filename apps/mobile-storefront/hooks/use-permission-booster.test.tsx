import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';

const mockNotificationsModuleLoad = jest.fn();
const mockGetPermissionsAsync = jest
  .fn<() => Promise<{ status: string }>>()
  .mockResolvedValue({ status: 'granted' });
const mockRequestPermissionsAsync = jest
  .fn<() => Promise<{ status: string }>>()
  .mockResolvedValue({ status: 'granted' });
let mockRejectNextNotificationsModuleLoad = false;

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

beforeEach(() => {
  jest.clearAllMocks();
  mockRejectNextNotificationsModuleLoad = false;
  mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
  mockRequestPermissionsAsync.mockResolvedValue({ status: 'granted' });
  jest.useRealTimers();
});

afterEach(() => {
  jest.useRealTimers();
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
      'Notification permission API unavailable:',
      'getPermissionsAsync'
    );
  });

  it('returns null instead of throwing when notification permission status calls fail', async () => {
    const permissionError = new TypeError('undefined is not a function');
    const warnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const { getNotificationPermissionStatus } = await import(
      './use-permission-booster'
    );
    const getPermissionsAsync = () => Promise.reject(permissionError);

    await expect(
      getNotificationPermissionStatus({
        getPermissionsAsync,
      })
    ).resolves.toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      'Notification permission API failed:',
      'getPermissionsAsync',
      permissionError
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
      'Notification permission API unavailable:',
      'requestPermissionsAsync'
    );
  });

  it('returns false instead of throwing when notification permission request calls fail', async () => {
    const permissionError = new TypeError('undefined is not a function');
    const warnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const { requestNotificationPermissionStatus } = await import(
      './use-permission-booster'
    );
    const requestPermissionsAsync = () => Promise.reject(permissionError);

    await expect(
      requestNotificationPermissionStatus({
        requestPermissionsAsync,
      })
    ).resolves.toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      'Notification permission API failed:',
      'requestPermissionsAsync',
      permissionError
    );
  });
});
