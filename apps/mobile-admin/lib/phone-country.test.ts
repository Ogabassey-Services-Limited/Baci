import { describe, expect, it } from 'vitest';
import {
  formatPhoneNumberForCountry,
  getNationalPhoneNumber,
  getPhoneCountryByCode,
  getPhoneCountryFromValue,
} from './phone-country';

describe('phone-country', () => {
  it('returns the enriched country metadata for a country code', () => {
    const country = getPhoneCountryByCode('NG');

    expect(country.code).toBe('NG');
    expect(country.callingCode).toBe('234');
    expect(country.flagEmoji).toBe('🇳🇬');
  });

  it('falls back to the default country for an unknown country code', () => {
    const country = getPhoneCountryByCode('XX');

    expect(country.code).toBe('NG');
  });

  it('detects the country from an international phone number', () => {
    const country = getPhoneCountryFromValue('+2347084011480');

    expect(country.code).toBe('NG');
  });

  it('falls back to the default country for malformed or empty inputs', () => {
    expect(getPhoneCountryFromValue('')).toMatchObject({ code: 'NG' });
    expect(getPhoneCountryFromValue('hello world')).toMatchObject({
      code: 'NG',
    });
    expect(getPhoneCountryFromValue(undefined)).toMatchObject({ code: 'NG' });
  });

  it('extracts the national number from an international phone number', () => {
    expect(getNationalPhoneNumber('+2347084011480')).toBe('7084011480');
  });

  it('returns an empty national number for empty or invalid values', () => {
    expect(getNationalPhoneNumber('')).toBe('');
    expect(getNationalPhoneNumber(undefined)).toBe('');
    expect(getNationalPhoneNumber('abc')).toBe('');
  });

  it('formats a local phone number into E.164 for the selected country', () => {
    const nigeria = getPhoneCountryByCode('NG');

    expect(formatPhoneNumberForCountry('07084011480', nigeria)).toBe(
      '+2347084011480'
    );
  });

  it('formats local numbers for non-Nigerian countries', () => {
    const unitedStates = getPhoneCountryByCode('US');
    const unitedKingdom = getPhoneCountryByCode('GB');

    expect(formatPhoneNumberForCountry('02079460056', unitedKingdom)).toBe(
      '+442079460056'
    );
    expect(formatPhoneNumberForCountry('4155552671', unitedStates)).toBe(
      '+14155552671'
    );
  });

  it('does not double-prefix numbers that already include the country code', () => {
    const nigeria = getPhoneCountryByCode('NG');

    expect(formatPhoneNumberForCountry('2347084011480', nigeria)).toBe(
      '+2347084011480'
    );
    expect(formatPhoneNumberForCountry('+2347084011480', nigeria)).toBe(
      '+2347084011480'
    );
  });

  it('returns an empty string when formatting an invalid local number', () => {
    const nigeria = getPhoneCountryByCode('NG');

    expect(formatPhoneNumberForCountry('', nigeria)).toBe('');
    expect(formatPhoneNumberForCountry('---', nigeria)).toBe('');
  });
});
