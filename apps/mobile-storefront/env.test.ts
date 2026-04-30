import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;

describe('mobile env', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    if (originalApiUrl === undefined) {
      delete process.env.EXPO_PUBLIC_API_URL;
    } else {
      process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
    }
    jest.unmock('expo-constants');
    jest.resetModules();
  });

  it('uses the validated EXPO_PUBLIC_API_URL value', async () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://usebaci.com';
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: { expoConfig: { extra: {} } },
    }));

    const { EXPO_PUBLIC_API_URL } = await import('./env');

    expect(EXPO_PUBLIC_API_URL).toBe('https://usebaci.com');
  });

  it('falls back to the default API URL when no runtime value is set', async () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: { expoConfig: { extra: {} } },
    }));

    const { EXPO_PUBLIC_API_URL } = await import('./env');

    expect(EXPO_PUBLIC_API_URL).toBe('https://usebaci.com');
  });

  it('falls back to the Expo config API URL when no environment value is set', async () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: {
        expoConfig: {
          extra: { apiUrl: '  https://some-expo-fallback.test  ' },
        },
      },
    }));

    const { EXPO_PUBLIC_API_URL } = await import('./env');

    expect(EXPO_PUBLIC_API_URL).toBe('https://some-expo-fallback.test');
  });

  it('throws when the runtime API URL is malformed', async () => {
    process.env.EXPO_PUBLIC_API_URL = 'not-a-url';
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: { expoConfig: { extra: {} } },
    }));

    await expect(import('./env')).rejects.toThrow(
      'Invalid mobile environment configuration'
    );
  });
});
