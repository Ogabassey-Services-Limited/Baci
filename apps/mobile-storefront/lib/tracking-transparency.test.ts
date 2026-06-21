import { beforeEach, describe, expect, it, jest } from '@jest/globals';

let mockPlatformOS: 'ios' | 'android' | 'web' = 'ios';

jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockPlatformOS;
    },
  },
}));

describe('tracking transparency wrapper', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockPlatformOS = 'ios';
  });

  it('returns undetermined when the iOS tracking module fails during import', async () => {
    jest.doMock('expo-tracking-transparency', () => {
      throw new TypeError('undefined is not a function');
    });

    const { getTrackingPermissionStatus } = await import(
      './tracking-transparency'
    );

    await expect(getTrackingPermissionStatus()).resolves.toEqual({
      status: 'undetermined',
    });
  });

  it('returns denied when requesting tracking permission is unavailable', async () => {
    jest.doMock('expo-tracking-transparency', () => ({
      getTrackingPermissionsAsync: jest.fn(),
    }));

    const { requestTrackingPermissionStatus } = await import(
      './tracking-transparency'
    );

    await expect(requestTrackingPermissionStatus()).resolves.toEqual({
      status: 'denied',
    });
  });

  it('uses the native tracking transparency methods when available', async () => {
    const getTrackingPermissionsAsync = jest
      .fn<() => Promise<{ status: string }>>()
      .mockResolvedValue({ status: 'granted' });
    const requestTrackingPermissionsAsync = jest
      .fn<() => Promise<{ status: string }>>()
      .mockResolvedValue({ status: 'denied' });
    jest.doMock('expo-tracking-transparency', () => ({
      getTrackingPermissionsAsync,
      requestTrackingPermissionsAsync,
    }));

    const {
      getTrackingPermissionStatus,
      requestTrackingPermissionStatus,
    } = await import('./tracking-transparency');

    await expect(getTrackingPermissionStatus()).resolves.toEqual({
      status: 'granted',
    });
    await expect(requestTrackingPermissionStatus()).resolves.toEqual({
      status: 'denied',
    });
  });

  it('does not import the iOS tracking module on Android', async () => {
    mockPlatformOS = 'android';
    const getTrackingPermissionsAsync = jest.fn();
    jest.doMock('expo-tracking-transparency', () => ({
      getTrackingPermissionsAsync,
    }));

    const {
      getTrackingPermissionStatus,
      requestTrackingPermissionStatus,
    } = await import('./tracking-transparency');

    await expect(getTrackingPermissionStatus()).resolves.toEqual({
      status: 'granted',
    });
    await expect(requestTrackingPermissionStatus()).resolves.toEqual({
      status: 'granted',
    });
    expect(getTrackingPermissionsAsync).not.toHaveBeenCalled();
  });
});
