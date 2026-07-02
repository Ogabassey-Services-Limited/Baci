import { describe, expect, it, vi } from 'vitest';
import { resolveBaseUrl } from './api-base-url';

vi.mock('expo-constants', () => ({
  default: {
    expoConfig: {},
  },
}));

describe('resolveBaseUrl extracted module', () => {
  it('detects local Expo debugger hosts and preserves explicit local URLs', () => {
    expect(resolveBaseUrl({ hostUri: '192.168.1.50:8081', isDev: true })).toBe(
      'http://192.168.1.50:3000'
    );
    expect(
      resolveBaseUrl({
        configuredBaseUrl: 'http://localhost:3000/',
        hostUri: '192.168.1.50:8081',
        isDev: true,
      })
    ).toBe('http://localhost:3000');
  });

  it('uses the configured API URL when Expo is served from a link-local host', () => {
    expect(
      resolveBaseUrl({
        configuredBaseUrl: 'https://usebaci.com/',
        hostUri: '169.254.64.234:8082',
        isDev: true,
      })
    ).toBe('https://usebaci.com');
  });

  it('falls back to production URL outside development', () => {
    expect(resolveBaseUrl({ configuredBaseUrl: undefined, isDev: false })).toBe(
      'https://usebaci.com'
    );
  });
});
