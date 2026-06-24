import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MerchantData } from '@/hooks/merchant/types';
import {
  GOOGLE_MERCHANT_CENTER_ID_CUSTOM_SETTING,
  MERCHANT_WIDGET_IFRAME_ID,
  normalizeGoogleMerchantCenterId,
  normalizeHostname,
  resolveGoogleMerchantCenterId,
  resolveGoogleStoreWidgetPreference,
  resolveMerchantWidgetFrame,
  setMerchantWidgetFrameHidden,
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

describe('setMerchantWidgetFrameHidden', () => {
  afterEach(() => {
    // Restore any stubbed `document` (SSR case) before touching the DOM.
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('no-ops when no widget frame has been injected', () => {
    expect(resolveMerchantWidgetFrame()).toBeNull();
    expect(() => setMerchantWidgetFrameHidden(true)).not.toThrow();
  });

  it('hides and restores the injected widget frame matched by id', () => {
    const frame = document.createElement('iframe');
    frame.id = MERCHANT_WIDGET_IFRAME_ID;
    document.body.appendChild(frame);

    setMerchantWidgetFrameHidden(true);
    expect(frame.style.display).toBe('none');

    setMerchantWidgetFrameHidden(false);
    expect(frame.style.display).toBe('');
  });

  it('ignores a non-iframe element sharing the widget id', () => {
    const decoy = document.createElement('div');
    decoy.id = MERCHANT_WIDGET_IFRAME_ID;
    document.body.appendChild(decoy);

    expect(resolveMerchantWidgetFrame()).toBeNull();
    setMerchantWidgetFrameHidden(true);
    expect(decoy.style.display).toBe('');
  });

  it('falls back to the merchantverse iframe when no id matches', () => {
    const frame = document.createElement('iframe');
    frame.src = 'https://www.google.com/shopping/merchantverse/badge';
    document.body.appendChild(frame);

    expect(resolveMerchantWidgetFrame()).toBe(frame);
    setMerchantWidgetFrameHidden(true);
    expect(frame.style.display).toBe('none');
  });

  it('no-ops during SSR when document is unavailable', () => {
    vi.stubGlobal('document', undefined);
    expect(resolveMerchantWidgetFrame()).toBeNull();
    expect(() => setMerchantWidgetFrameHidden(true)).not.toThrow();
  });
});
