import { afterEach, describe, expect, it, vi } from 'vitest';
import { COUNTRIES } from '@/constants/countries';
import { normalizeMerchantCurrency } from './merchant-currency';

const selectableCountryCurrencies = [
  ...new Set(COUNTRIES.map(({ currency }) => currency.trim().toUpperCase())),
];

describe('normalizeMerchantCurrency', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('normalizes merchant currency codes before returning them', () => {
    expect(normalizeMerchantCurrency('ngn')).toBe('NGN');
    expect(normalizeMerchantCurrency(' usd ')).toBe('USD');
  });

  it('accepts every selectable country currency code', () => {
    for (const currency of selectableCountryCurrencies) {
      expect(normalizeMerchantCurrency(currency)).toBe(currency);
    }
  });

  it('falls back to selectable country currencies when supportedValuesOf is unavailable', async () => {
    vi.spyOn(Intl, 'supportedValuesOf').mockImplementation(() => {
      throw new RangeError('supportedValuesOf unavailable');
    });
    vi.resetModules();

    const { normalizeMerchantCurrency: normalizeFreshMerchantCurrency } =
      await import('./merchant-currency');

    for (const currency of selectableCountryCurrencies) {
      expect(normalizeFreshMerchantCurrency(currency)).toBe(currency);
    }
  });

  it('returns undefined for blank or invalid currency codes', () => {
    expect(normalizeMerchantCurrency('   ')).toBeUndefined();
    expect(normalizeMerchantCurrency('INVALID')).toBeUndefined();
    expect(normalizeMerchantCurrency('ABC')).toBeUndefined();
    expect(normalizeMerchantCurrency('ZZZ')).toBeUndefined();
  });
});
