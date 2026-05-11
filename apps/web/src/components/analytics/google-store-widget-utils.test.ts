import { describe, expect, it } from 'vitest';
import type { MerchantData } from '@/hooks/merchant/types';
import {
  normalizeHostname,
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
