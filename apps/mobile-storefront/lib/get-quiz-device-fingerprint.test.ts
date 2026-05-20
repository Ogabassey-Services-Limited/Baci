import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { Platform } from 'react-native';

const mockGetAndroidId = jest.fn<() => string | null>(() => 'android-id');
const mockGetIosIdForVendorAsync = jest.fn<() => Promise<string | null>>(
  async () => 'ios-id'
);
let mockApplicationName: string | null = 'Baci';

jest.mock('expo-application', () => ({
  get applicationName() {
    return mockApplicationName;
  },
  getAndroidId: mockGetAndroidId,
  getIosIdForVendorAsync: mockGetIosIdForVendorAsync,
}));

jest.mock('./quiz-fingerprint', () => ({
  createQuizFingerprint: jest.fn(async () => 'fingerprint-hash'),
}));

const Application =
  require('expo-application') as typeof import('expo-application');
const { createQuizFingerprint } =
  require('./quiz-fingerprint') as typeof import('./quiz-fingerprint');
const { getQuizDeviceFingerprint } =
  require('./get-quiz-device-fingerprint') as typeof import('./get-quiz-device-fingerprint');

const originalPlatformOS = Platform.OS;

function setPlatform(os: typeof Platform.OS) {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: os,
  });
}

describe('getQuizDeviceFingerprint', () => {
  afterEach(() => {
    mockApplicationName = 'Baci';
    setPlatform(originalPlatformOS);
    jest.clearAllMocks();
  });

  it('uses the Android installation id for fingerprint signals', async () => {
    setPlatform('android');
    mockGetAndroidId.mockReturnValueOnce('android-device-id');

    await expect(getQuizDeviceFingerprint()).resolves.toBe('fingerprint-hash');

    expect(Application.getAndroidId).toHaveBeenCalled();
    expect(createQuizFingerprint).toHaveBeenCalledWith({
      installationId: 'android-device-id',
      deviceName: 'Baci',
      osName: 'android',
    });
  });

  it('uses the iOS vendor id for fingerprint signals', async () => {
    setPlatform('ios');
    mockGetIosIdForVendorAsync.mockResolvedValueOnce('ios-vendor-id');

    await expect(getQuizDeviceFingerprint()).resolves.toBe('fingerprint-hash');

    expect(Application.getIosIdForVendorAsync).toHaveBeenCalled();
    expect(createQuizFingerprint).toHaveBeenCalledWith({
      installationId: 'ios-vendor-id',
      deviceName: 'Baci',
      osName: 'ios',
    });
  });

  it('passes null installation ids through to fingerprint creation', async () => {
    setPlatform('android');
    mockGetAndroidId.mockReturnValueOnce(null);

    await expect(getQuizDeviceFingerprint()).resolves.toBe('fingerprint-hash');

    expect(createQuizFingerprint).toHaveBeenCalledWith({
      installationId: null,
      deviceName: 'Baci',
      osName: 'android',
    });
  });

  it('normalizes null application names before fingerprint creation', async () => {
    setPlatform('android');
    mockApplicationName = null;
    mockGetAndroidId.mockReturnValueOnce('android-device-id');
    jest.mocked(createQuizFingerprint).mockResolvedValueOnce(null);

    await expect(getQuizDeviceFingerprint()).resolves.toBeNull();

    expect(createQuizFingerprint).toHaveBeenCalledWith({
      installationId: 'android-device-id',
      deviceName: '',
      osName: 'android',
    });
  });

  it('passes null iOS vendor ids through to fingerprint creation', async () => {
    setPlatform('ios');
    mockGetIosIdForVendorAsync.mockResolvedValueOnce(null);

    await expect(getQuizDeviceFingerprint()).resolves.toBe('fingerprint-hash');

    expect(createQuizFingerprint).toHaveBeenCalledWith({
      installationId: null,
      deviceName: 'Baci',
      osName: 'ios',
    });
  });

  it('does not call iOS installation APIs on unsupported platforms', async () => {
    setPlatform('web');

    await expect(getQuizDeviceFingerprint()).resolves.toBe('fingerprint-hash');

    expect(Application.getAndroidId).not.toHaveBeenCalled();
    expect(Application.getIosIdForVendorAsync).not.toHaveBeenCalled();
    expect(createQuizFingerprint).toHaveBeenCalledWith({
      installationId: null,
      deviceName: 'Baci',
      osName: 'web',
    });
  });

  it('rejects when fingerprint hashing fails', async () => {
    const failure = new Error('hash unavailable');
    setPlatform('android');
    mockGetAndroidId.mockReturnValueOnce('android-device-id');
    jest.mocked(createQuizFingerprint).mockRejectedValueOnce(failure);

    await expect(getQuizDeviceFingerprint()).rejects.toThrow(
      'hash unavailable'
    );
  });

  it('rejects when native iOS installation lookup fails', async () => {
    const failure = new Error('vendor unavailable');
    setPlatform('ios');
    mockGetIosIdForVendorAsync.mockRejectedValueOnce(failure);

    await expect(getQuizDeviceFingerprint()).rejects.toThrow(
      'vendor unavailable'
    );
    expect(createQuizFingerprint).not.toHaveBeenCalled();
  });
});
