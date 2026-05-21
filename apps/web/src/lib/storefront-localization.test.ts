import { describe, expect, it } from 'vitest';
import {
  appendCountryContext,
  getCountryShoppingContext,
  getStorefrontLocale,
} from './storefront-localization';

describe('getCountryShoppingContext', () => {
  it('defaults unknown and Nigerian storefronts to Nigeria search context', () => {
    expect(getCountryShoppingContext('NG')).toBe('in Nigeria');
    expect(getCountryShoppingContext(null)).toBe('in Nigeria');
    expect(getCountryShoppingContext(undefined)).toBe('in Nigeria');
  });

  it('omits Nigeria copy for non-Nigerian storefront countries', () => {
    expect(getCountryShoppingContext('GH')).toBe('');
    expect(getCountryShoppingContext('KE')).toBe('');
    expect(getCountryShoppingContext('US')).toBe('');
  });

  it('treats empty and lowercase country codes explicitly', () => {
    expect(getCountryShoppingContext('')).toBe('in Nigeria');
    expect(getCountryShoppingContext('ng')).toBe('');
  });
});

describe('getStorefrontLocale', () => {
  it('returns known storefront locales and falls back to Nigeria', () => {
    expect(getStorefrontLocale('NG')).toBe('en-NG');
    expect(getStorefrontLocale('GH')).toBe('en-GH');
    expect(getStorefrontLocale('KE')).toBe('en-KE');
    expect(getStorefrontLocale('US')).toBe('en-US');
    expect(getStorefrontLocale('ZA')).toBe('en-NG');
    expect(getStorefrontLocale(undefined)).toBe('en-NG');
  });
});

describe('appendCountryContext', () => {
  it('appends country context only when present', () => {
    expect(appendCountryContext('Apple vs Samsung', 'in Nigeria')).toBe(
      'Apple vs Samsung in Nigeria'
    );
    expect(appendCountryContext('Apple vs Samsung', '')).toBe(
      'Apple vs Samsung'
    );
  });
});
