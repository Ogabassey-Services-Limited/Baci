import { describe, expect, it } from 'vitest';
import type { MerchantData } from '@/hooks/merchant/types';
import {
  GOOGLE_MERCHANT_CENTER_ID_CUSTOM_SETTING,
  normalizeGoogleMerchantCenterId,
  normalizeHostname,
  resolveGoogleMerchantCenterId,
  resolveGoogleStoreWidgetPreference,
} from './google-store-widget-utils';

const baseMerchant: MerchantData = {
  id: 'merchant-1',
  user_id: 'user-1',
  business_name: 'Ogabassey',
  business_type: 'electronics',
  slug: 'ogabassey',
  custom_domain: 'ogabassey.com',
};

describe('normalizeHostname', () => {
  it('returns an empty string for undefined input', () => {
    expect(normalizeHostname(undefined)).toBe('');
  });

  it('strips the protocol from a URL', () => {
    expect(normalizeHostname('https://ogabassey.com')).toBe('ogabassey.com');
    expect(normalizeHostname('http://ogabassey.com')).toBe('ogabassey.com');
  });

  it('strips the pathname from a URL', () => {
    expect(normalizeHostname('ogabassey.com/products')).toBe('ogabassey.com');
  });

  it('strips a leading www prefix', () => {
    expect(normalizeHostname('www.ogabassey.com')).toBe('ogabassey.com');
  });

  it('lowercases the hostname', () => {
    expect(normalizeHostname('WWW.Ogabassey.COM')).toBe('ogabassey.com');
  });

  it('handles a full URL with protocol, www, and path', () => {
    expect(normalizeHostname('https://www.ogabassey.com/shop')).toBe(
      'ogabassey.com'
    );
  });

  it('trims whitespace', () => {
    expect(normalizeHostname('  ogabassey.com  ')).toBe('ogabassey.com');
  });
});

describe('normalizeGoogleMerchantCenterId', () => {
  it('accepts numeric string IDs', () => {
    expect(normalizeGoogleMerchantCenterId(' 112524323 ')).toBe('112524323');
  });

  it('accepts positive integer IDs stored as numbers', () => {
    expect(normalizeGoogleMerchantCenterId(112_524_323)).toBe('112524323');
  });

  it('preserves numeric strings with leading zeros', () => {
    expect(normalizeGoogleMerchantCenterId('00123')).toBe('00123');
  });

  it('rejects nonnumeric IDs', () => {
    expect(normalizeGoogleMerchantCenterId('GMC-112524323')).toBeNull();
  });

  it('rejects nonpositive and noninteger numbers', () => {
    expect(normalizeGoogleMerchantCenterId(0)).toBeNull();
    expect(normalizeGoogleMerchantCenterId(-123)).toBeNull();
    expect(normalizeGoogleMerchantCenterId(123.45)).toBeNull();
  });

  it('rejects empty and nullish inputs', () => {
    expect(normalizeGoogleMerchantCenterId('')).toBeNull();
    expect(normalizeGoogleMerchantCenterId(null)).toBeNull();
    expect(normalizeGoogleMerchantCenterId(undefined)).toBeNull();
  });
});

describe('resolveGoogleMerchantCenterId', () => {
  it('reads the Merchant Center ID from custom settings', () => {
    expect(
      resolveGoogleMerchantCenterId({
        ...baseMerchant,
        feature_settings: {
          custom_settings: {
            [GOOGLE_MERCHANT_CENTER_ID_CUSTOM_SETTING]: '112524323',
          },
        },
      })
    ).toBe('112524323');
  });

  it('returns null when the custom setting is absent', () => {
    expect(resolveGoogleMerchantCenterId(baseMerchant)).toBeNull();
  });

  it('returns null when merchant feature settings are malformed', () => {
    expect(resolveGoogleMerchantCenterId(undefined)).toBeNull();
    expect(
      resolveGoogleMerchantCenterId({
        ...baseMerchant,
        feature_settings: null,
      } as unknown as MerchantData)
    ).toBeNull();
    expect(
      resolveGoogleMerchantCenterId({
        ...baseMerchant,
        feature_settings: 'bad-settings',
      } as unknown as MerchantData)
    ).toBeNull();
    expect(
      resolveGoogleMerchantCenterId({
        ...baseMerchant,
        feature_settings: [],
      } as unknown as MerchantData)
    ).toBeNull();
  });

  it('returns null when custom settings are missing or invalid', () => {
    expect(
      resolveGoogleMerchantCenterId({
        ...baseMerchant,
        feature_settings: {},
      })
    ).toBeNull();
    expect(
      resolveGoogleMerchantCenterId({
        ...baseMerchant,
        feature_settings: {
          custom_settings: {},
        },
      })
    ).toBeNull();
    expect(
      resolveGoogleMerchantCenterId({
        ...baseMerchant,
        feature_settings: {
          custom_settings: {
            [GOOGLE_MERCHANT_CENTER_ID_CUSTOM_SETTING]: 'GMC-112524323',
          },
        },
      })
    ).toBeNull();
  });
});

describe('resolveGoogleStoreWidgetPreference', () => {
  it('returns undefined when merchant is undefined', () => {
    expect(resolveGoogleStoreWidgetPreference(undefined)).toBeUndefined();
  });

  it('prefers the direct feature setting when present', () => {
    expect(
      resolveGoogleStoreWidgetPreference({
        ...baseMerchant,
        feature_settings: {
          google_store_widget_enabled: false,
          custom_settings: { google_store_widget_enabled: true },
        },
      })
    ).toBe(false);
  });

  it('falls back to custom settings when the direct feature setting is absent', () => {
    expect(
      resolveGoogleStoreWidgetPreference({
        ...baseMerchant,
        feature_settings: {
          custom_settings: { google_store_widget_enabled: true },
        },
      })
    ).toBe(true);
  });

  it('returns undefined when no explicit preference is configured', () => {
    expect(resolveGoogleStoreWidgetPreference(baseMerchant)).toBeUndefined();
  });
});
