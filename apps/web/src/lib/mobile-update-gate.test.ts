import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  parseBuildNumber,
  readMobilePlatformEnv,
  readMobileUpdateMessage,
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
      expect(readMobileUpdatesEnabled('storefront')).toBe(true);
    });

    it.each(['false', '0', 'no', ''])('is false for %s', (value) => {
      vi.stubEnv('MOBILE_STOREFRONT_UPDATES_ENABLED', value);
      expect(readMobileUpdatesEnabled('storefront')).toBe(false);
    });

    it('is namespaced per app', () => {
      vi.stubEnv('MOBILE_ADMIN_UPDATES_ENABLED', 'true');
      expect(readMobileUpdatesEnabled('admin')).toBe(true);
      expect(readMobileUpdatesEnabled('storefront')).toBe(false);
    });
  });

  describe('readMobilePlatformEnv', () => {
    it('reads the app+platform-prefixed env var, trimmed', () => {
      vi.stubEnv('MOBILE_STOREFRONT_ANDROID_LATEST_BUILD', '  646  ');
      expect(
        readMobilePlatformEnv('storefront', 'android', 'LATEST_BUILD')
      ).toBe('646');
    });

    it('scopes by app', () => {
      vi.stubEnv('MOBILE_ADMIN_IOS_STORE_URL', 'https://apps.apple.com/admin');
      expect(readMobilePlatformEnv('admin', 'ios', 'STORE_URL')).toBe(
        'https://apps.apple.com/admin'
      );
      expect(
        readMobilePlatformEnv('storefront', 'ios', 'STORE_URL')
      ).toBeNull();
    });

    it('returns null when unset or blank', () => {
      vi.stubEnv('MOBILE_STOREFRONT_IOS_STORE_URL', '   ');
      expect(
        readMobilePlatformEnv('storefront', 'ios', 'STORE_URL')
      ).toBeNull();
      expect(
        readMobilePlatformEnv('storefront', 'ios', 'MIN_BUILD')
      ).toBeNull();
    });
  });

  describe('readMobileUpdateMessage', () => {
    it('returns the configured per-app message', () => {
      vi.stubEnv('MOBILE_ADMIN_UPDATE_MESSAGE', 'Admin update ready');
      expect(readMobileUpdateMessage('admin')).toBe('Admin update ready');
    });

    it('falls back to an app-specific default', () => {
      expect(readMobileUpdateMessage('storefront')).toContain('Ogabassey');
      expect(readMobileUpdateMessage('admin')).toContain('admin');
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
