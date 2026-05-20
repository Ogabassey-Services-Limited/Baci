import { describe, expect, it, jest } from '@jest/globals';
import { Platform } from 'react-native';

const mockGetAndroidId = jest.fn<() => string | null>(() => 'android-id');
const mockGetIosIdForVendorAsync = jest.fn<() => Promise<string | null>>(
  async () => 'ios-id'
);
const mockDigestStringAsync = jest.fn<
  (algorithm: string, value: string) => Promise<string>
>(async () => 'f'.repeat(64));
let mockApplicationName: string | null = 'Baci';

jest.mock('expo-application', () => ({
  get applicationName() {
    return mockApplicationName;
  },
  getAndroidId: mockGetAndroidId,
  getIosIdForVendorAsync: mockGetIosIdForVendorAsync,
}));

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA256' },
  digestStringAsync: mockDigestStringAsync,
}));

const { createQuizFingerprint } =
  require('./quiz-fingerprint') as typeof import('./quiz-fingerprint');
const { getQuizDeviceFingerprint } =
  require('./get-quiz-device-fingerprint') as typeof import('./get-quiz-device-fingerprint');

function setPlatform(os: 'android' | 'ios') {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: os,
  });
}

describe('createQuizFingerprint', () => {
  it('returns a deterministic fingerprint for stable device signals', async () => {
    const hasher = jest.fn(async (value: string) => `hash:${value}`);

    await expect(
      createQuizFingerprint(
        {
          installationId: 'install-1',
          deviceName: 'iPhone 15',
          osName: 'ios',
        },
        hasher
      )
    ).resolves.toBe('hash:["install-1","iPhone 15","ios"]');
    expect(hasher).toHaveBeenCalledWith('["install-1","iPhone 15","ios"]');
  });

  it('trims stable device signals before hashing', async () => {
    const hasher = jest.fn(async (value: string) => `hash:${value}`);

    await expect(
      createQuizFingerprint(
        {
          installationId: ' install-1 ',
          deviceName: ' iPhone 15 ',
          osName: ' ios ',
        },
        hasher
      )
    ).resolves.toBe('hash:["install-1","iPhone 15","ios"]');
    expect(hasher).toHaveBeenCalledWith('["install-1","iPhone 15","ios"]');
  });

  it('uses the default SHA-256 hasher when none is provided', async () => {
    await expect(
      createQuizFingerprint({
        installationId: 'install-1',
        deviceName: 'iPhone 15',
        osName: 'ios',
      })
    ).resolves.toBe('f'.repeat(64));
    expect(mockDigestStringAsync).toHaveBeenCalledWith(
      'SHA256',
      '["install-1","iPhone 15","ios"]'
    );
  });

  it('serializes values without delimiter collisions', async () => {
    const serializedValues: string[] = [];

    await createQuizFingerprint(
      {
        installationId: 'install|device',
        deviceName: 'name',
        osName: 'ios',
      },
      async (value) => {
        serializedValues.push(value);
        return 'hash-a';
      }
    );
    await createQuizFingerprint(
      {
        installationId: 'install',
        deviceName: 'device|name',
        osName: 'ios',
      },
      async (value) => {
        serializedValues.push(value);
        return 'hash-b';
      }
    );

    expect(serializedValues[0]).not.toBe(serializedValues[1]);
  });

  it('returns null when required stable signals are missing', async () => {
    const missingSignals = [
      { installationId: '', deviceName: 'iPhone 15', osName: 'ios' },
      { installationId: '   ', deviceName: 'iPhone 15', osName: 'ios' },
      { installationId: 'install-1', deviceName: '', osName: 'ios' },
      { installationId: 'install-1', deviceName: 'iPhone 15', osName: '' },
      { installationId: null, deviceName: null, osName: null },
    ];

    for (const signals of missingSignals) {
      await expect(
        createQuizFingerprint(signals, async (value) => `hash:${value}`)
      ).resolves.toBeNull();
    }
  });
});

describe('getQuizDeviceFingerprint', () => {
  afterEach(() => {
    mockApplicationName = 'Baci';
    jest.clearAllMocks();
  });

  it('builds native device fingerprints for Android and iOS', async () => {
    setPlatform('android');
    await expect(getQuizDeviceFingerprint()).resolves.toMatch(/^[a-f0-9]{64}$/);
    expect(mockGetAndroidId).toHaveBeenCalled();

    setPlatform('ios');
    await expect(getQuizDeviceFingerprint()).resolves.toMatch(/^[a-f0-9]{64}$/);
    expect(mockGetIosIdForVendorAsync).toHaveBeenCalled();
  });

  it('returns null when native installation id is unavailable', async () => {
    setPlatform('ios');
    mockGetIosIdForVendorAsync.mockResolvedValueOnce(null);

    await expect(getQuizDeviceFingerprint()).resolves.toBeNull();
  });

  it('returns null when the native application name is unavailable', async () => {
    setPlatform('android');
    mockApplicationName = null;
    mockGetAndroidId.mockReturnValueOnce('android-id');

    await expect(getQuizDeviceFingerprint()).resolves.toBeNull();
  });
});
