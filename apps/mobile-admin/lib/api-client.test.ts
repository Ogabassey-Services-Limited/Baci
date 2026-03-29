import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-constants', () => ({
  default: {
    expoConfig: {},
  },
}));

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
  },
}));

import { resolveBaseUrl } from './api-client';

describe('resolveBaseUrl', () => {
  it('prefers an explicitly configured dev API origin', () => {
    expect(
      resolveBaseUrl({
        isDev: true,
        configuredBaseUrl: 'https://usebaci.com/',
        hostUri: '192.168.1.10:8081',
      })
    ).toBe('https://usebaci.com');
  });

  it('derives an IPv4 dev origin from Expo hostUri', () => {
    expect(
      resolveBaseUrl({
        isDev: true,
        configuredBaseUrl: '',
        fallbackConfiguredBaseUrl: '',
        hostUri: '192.168.1.10:8081',
      })
    ).toBe('http://192.168.1.10:3000');
  });

  it('derives an IPv6 dev origin from a bracketed Expo hostUri', () => {
    expect(
      resolveBaseUrl({
        isDev: true,
        configuredBaseUrl: '',
        fallbackConfiguredBaseUrl: '',
        hostUri: '[2001:db8::1]:8081',
      })
    ).toBe('http://[2001:db8::1]:3000');
  });

  it('falls back to localhost when no dev host is available', () => {
    expect(
      resolveBaseUrl({
        isDev: true,
        configuredBaseUrl: '',
        fallbackConfiguredBaseUrl: '',
        hostUri: undefined,
      })
    ).toBe('http://localhost:3000');
  });

  it('trims trailing slashes in production origins', () => {
    expect(
      resolveBaseUrl({
        isDev: false,
        configuredBaseUrl: 'https://usebaci.com/',
      })
    ).toBe('https://usebaci.com');
  });
});
