import { Platform } from 'react-native';

const mockGetTrackingPermissionsAsync = jest
  .fn()
  .mockResolvedValue({ status: 'denied' });
const mockRequestTrackingPermissionsAsync = jest
  .fn()
  .mockResolvedValue({ status: 'granted' });
const mockTrackingTransparencyModuleLoad = jest.fn();

jest.mock('expo-tracking-transparency', () => {
  mockTrackingTransparencyModuleLoad();

  return {
    getTrackingPermissionsAsync: mockGetTrackingPermissionsAsync,
    requestTrackingPermissionsAsync: mockRequestTrackingPermissionsAsync,
  };
});

const originalPlatformOS = Platform.OS;

function setPlatform(os: typeof Platform.OS) {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: os,
  });
}

describe('tracking transparency web boundary', () => {
  afterEach(() => {
    setPlatform(originalPlatformOS);
    jest.clearAllMocks();
  });

  it('does not load the native ATT module outside iOS', async () => {
    setPlatform('web');
    const { getTrackingPermissionStatus, requestTrackingPermissionStatus } =
      await import('./tracking-transparency');

    await expect(getTrackingPermissionStatus()).resolves.toEqual({
      status: 'granted',
    });
    await expect(requestTrackingPermissionStatus()).resolves.toEqual({
      status: 'granted',
    });

    expect(mockTrackingTransparencyModuleLoad).not.toHaveBeenCalled();
    expect(mockGetTrackingPermissionsAsync).not.toHaveBeenCalled();
    expect(mockRequestTrackingPermissionsAsync).not.toHaveBeenCalled();
  });

  it('loads the native ATT module on iOS permission access', async () => {
    setPlatform('ios');
    const { getTrackingPermissionStatus, requestTrackingPermissionStatus } =
      await import('./tracking-transparency');

    await expect(getTrackingPermissionStatus()).resolves.toEqual({
      status: 'denied',
    });
    await expect(requestTrackingPermissionStatus()).resolves.toEqual({
      status: 'granted',
    });

    expect(mockTrackingTransparencyModuleLoad).toHaveBeenCalledTimes(1);
    expect(mockGetTrackingPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(mockRequestTrackingPermissionsAsync).toHaveBeenCalledTimes(1);
  });
});
