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

  it('uses the fallback configured API URL when a link-local host has no primary URL', () => {
    expect(
      resolveBaseUrl({
        fallbackConfiguredBaseUrl: 'https://usebaci.com/',
        hostUri: '169.254.64.234:8082',
        isDev: true,
      })
    ).toBe('https://usebaci.com');
  });

  it('falls through to the detected local URL when a link-local host has no configured URLs', () => {
    expect(
      resolveBaseUrl({
        configuredBaseUrl: undefined,
        fallbackConfiguredBaseUrl: undefined,
        hostUri: '169.254.64.234:8082',
        isDev: true,
      })
    ).toBe('http://169.254.64.234:3000');
  });

  it('falls back to production URL outside development', () => {
    expect(resolveBaseUrl({ configuredBaseUrl: undefined, isDev: false })).toBe(
      'https://usebaci.com'
    );
  });
});
