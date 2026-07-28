import { describe, expect, it } from 'vitest';
import { MERCHANT_COUNTRIES } from './merchant-countries';

const EXPECTED_CODES = [
  'US',
  'NG',
  'GB',
  'CA',
  'AU',
  'DE',
  'FR',
  'JP',
  'IN',
  'BR',
  'ZA',
  'AE',
  'KE',
  'GH',
  'EG',
  'CM',
  'CI',
  'SN',
  'BF',
  'RW',
  'TZ',
  'UG',
] as const;

describe('MERCHANT_COUNTRIES', () => {
  it('keeps the supported merchant onboarding catalog stable', () => {
    expect(MERCHANT_COUNTRIES.map(({ code }) => code)).toEqual(EXPECTED_CODES);
  });

  it('uses unique uppercase ISO-2 codes and ISO-4217 currencies', () => {
    const codes = new Set<string>();

    for (const country of MERCHANT_COUNTRIES) {
      expect(country.code).toMatch(/^[A-Z]{2}$/);
      expect(codes.has(country.code)).toBe(false);
      codes.add(country.code);
      expect(country.currency).toMatch(/^[A-Z]{3}$/);
      expect(() =>
        new Intl.NumberFormat('en', {
          style: 'currency',
          currency: country.currency,
        }).format(1)
      ).not.toThrow();
    }
  });

  it('provides stable display and phone metadata for every country', () => {
    for (const country of MERCHANT_COUNTRIES) {
      expect(country.name.trim().length).toBeGreaterThan(0);
      expect(country.flag.trim().length).toBeGreaterThan(0);
      expect(country.phoneCode).toMatch(/^\+\d+$/);
      expect(country.currencySymbol.trim().length).toBeGreaterThan(0);
    }
  });
});
