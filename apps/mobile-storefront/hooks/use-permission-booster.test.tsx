import { act, renderHook } from '@testing-library/react-native';

const mockNotificationsModuleLoad = jest.fn();
const mockGetPermissionsAsync = jest
  .fn()
  .mockResolvedValue({ status: 'granted' });
const mockRequestPermissionsAsync = jest
  .fn()
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

jest.mock('expo-tracking-transparency', () => ({
  requestTrackingPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ status: 'granted' }),
}));

describe('usePermissionBooster native module loading', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRejectNextNotificationsModuleLoad = false;
    mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockRequestPermissionsAsync.mockResolvedValue({ status: 'granted' });
  });

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
});
