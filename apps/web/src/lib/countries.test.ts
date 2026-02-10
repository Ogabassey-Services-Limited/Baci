import { describe, expect, it } from 'vitest';
import { getCountryByCode } from '@/lib/countries';

describe('getCountryByCode', () => {
  it('returns country by uppercase code', () => {
    const country = getCountryByCode('NG');
    expect(country).toBeDefined();
    expect(country?.name).toBe('Nigeria');
    expect(country?.code).toBe('NG');
  });

  it('returns country by lowercase code', () => {
    const country = getCountryByCode('ng');
    expect(country).toBeDefined();
    expect(country?.name).toBe('Nigeria');
  });

  it('returns country by mixed case code', () => {
    const country = getCountryByCode('Ng');
    expect(country).toBeDefined();
    expect(country?.name).toBe('Nigeria');
  });

  it('returns country by exact name', () => {
    const country = getCountryByCode('United States');
    expect(country).toBeDefined();
    expect(country?.code).toBe('US');
  });

  it('returns country by lowercase name', () => {
    const country = getCountryByCode('united states');
    expect(country).toBeDefined();
    expect(country?.code).toBe('US');
  });

  it('returns country by mixed case name', () => {
    const country = getCountryByCode('United states');
    expect(country).toBeDefined();
    expect(country?.code).toBe('US');
  });

  it('returns United Kingdom for code "GB"', () => {
    const country = getCountryByCode('GB');
    expect(country?.name).toBe('United Kingdom');
  });

  it('returns undefined for unmapped code "UK"', () => {
    expect(getCountryByCode('UK')).toBeUndefined();
  });

  it('returns undefined for invalid code', () => {
    expect(getCountryByCode('ZZ')).toBeUndefined();
  });

  it('returns undefined for unrecognized name', () => {
    expect(getCountryByCode('Atlantis')).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(getCountryByCode('')).toBeUndefined();
  });

  it('returns undefined for null/undefined at runtime', () => {
    // @ts-expect-error - testing JS boundary
    expect(getCountryByCode(null)).toBeUndefined();
    // @ts-expect-error - testing JS boundary
    expect(getCountryByCode(undefined)).toBeUndefined();
  });
});
