import { beforeEach, describe, expect, it, vi } from 'vitest';

const platformState = vi.hoisted(() => ({
  os: 'ios' as 'ios' | 'android' | 'web',
}));

vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return platformState.os;
    },
  },
}));

describe('tracking transparency wrapper', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    platformState.os = 'ios';
  });

  it('returns undetermined when the iOS tracking module fails during import', async () => {
    vi.doMock('expo-tracking-transparency', () => {
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
    vi.doMock('expo-tracking-transparency', () => ({
      getTrackingPermissionsAsync: vi.fn(),
      requestTrackingPermissionsAsync: undefined,
    }));

    const { requestTrackingPermissionStatus } = await import(
      './tracking-transparency'
    );

    await expect(requestTrackingPermissionStatus()).resolves.toEqual({
      status: 'denied',
    });
  });

  it('uses the native tracking transparency methods when available', async () => {
    const getTrackingPermissionsAsync = vi
      .fn<() => Promise<{ status: string }>>()
      .mockResolvedValue({ status: 'granted' });
    const requestTrackingPermissionsAsync = vi
      .fn<() => Promise<{ status: string }>>()
      .mockResolvedValue({ status: 'denied' });
    vi.doMock('expo-tracking-transparency', () => ({
      getTrackingPermissionsAsync,
      requestTrackingPermissionsAsync,
    }));

    const { getTrackingPermissionStatus, requestTrackingPermissionStatus } =
      await import('./tracking-transparency');

    await expect(getTrackingPermissionStatus()).resolves.toEqual({
      status: 'granted',
    });
    await expect(requestTrackingPermissionStatus()).resolves.toEqual({
      status: 'denied',
    });
  });

  it('does not import the iOS tracking module on Android', async () => {
    platformState.os = 'android';
    const getTrackingPermissionsAsync = vi.fn();
    vi.doMock('expo-tracking-transparency', () => ({
      getTrackingPermissionsAsync,
    }));

    const { getTrackingPermissionStatus, requestTrackingPermissionStatus } =
      await import('./tracking-transparency');

    await expect(getTrackingPermissionStatus()).resolves.toEqual({
      status: 'granted',
    });
    await expect(requestTrackingPermissionStatus()).resolves.toEqual({
      status: 'granted',
    });
    expect(getTrackingPermissionsAsync).not.toHaveBeenCalled();
  });
});
