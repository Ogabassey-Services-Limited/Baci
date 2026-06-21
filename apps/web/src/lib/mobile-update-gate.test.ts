import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  parseBuildNumber,
  readMobilePlatformEnv,
  readMobileUpdatesEnabled,
} from './mobile-update-gate';

describe('mobile-update-gate', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('readMobileUpdatesEnabled', () => {
    it.each([
      'true',
      '1',
      'yes',
      'TRUE',
      ' Yes ',
    ])('is true for %s', (value) => {
      vi.stubEnv('MOBILE_STOREFRONT_UPDATES_ENABLED', value);
      expect(readMobileUpdatesEnabled()).toBe(true);
    });

    it.each(['false', '0', 'no', ''])('is false for %s', (value) => {
      vi.stubEnv('MOBILE_STOREFRONT_UPDATES_ENABLED', value);
      expect(readMobileUpdatesEnabled()).toBe(false);
    });
  });

  describe('readMobilePlatformEnv', () => {
    it('reads the platform-prefixed env var, trimmed', () => {
      vi.stubEnv('MOBILE_STOREFRONT_ANDROID_LATEST_BUILD', '  646  ');
      expect(readMobilePlatformEnv('android', 'LATEST_BUILD')).toBe('646');
    });

    it('returns null when unset or blank', () => {
      vi.stubEnv('MOBILE_STOREFRONT_IOS_STORE_URL', '   ');
      expect(readMobilePlatformEnv('ios', 'STORE_URL')).toBeNull();
      expect(readMobilePlatformEnv('ios', 'MIN_BUILD')).toBeNull();
    });
  });

  describe('parseBuildNumber', () => {
    it('parses non-negative integers', () => {
      expect(parseBuildNumber('646')).toBe(646);
      expect(parseBuildNumber(' 0 ')).toBe(0);
    });

    it('returns null for null, blank, non-integer, or negative input', () => {
      expect(parseBuildNumber(null)).toBeNull();
      expect(parseBuildNumber('   ')).toBeNull();
      expect(parseBuildNumber('abc')).toBeNull();
      expect(parseBuildNumber('1.5')).toBeNull();
      expect(parseBuildNumber('-3')).toBeNull();
    });
  });
});
