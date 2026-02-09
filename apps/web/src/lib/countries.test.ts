import { describe, expect, it } from 'vitest';
import { getCountryByCode } from './countries';

describe('getCountryByCode', () => {
  it('should return country by code (uppercase)', () => {
    const country = getCountryByCode('NG');
    expect(country).toBeDefined();
    expect(country?.name).toBe('Nigeria');
    expect(country?.code).toBe('NG');
  });

  it('should return country by code (lowercase)', () => {
    const country = getCountryByCode('ng');
    expect(country).toBeDefined();
    expect(country?.name).toBe('Nigeria');
    expect(country?.code).toBe('NG');
  });

  it('should return country by name (Title Case)', () => {
    const country = getCountryByCode('Nigeria');
    expect(country).toBeDefined();
    expect(country?.code).toBe('NG');
  });

  it('should return country by name (lowercase)', () => {
    const country = getCountryByCode('nigeria');
    expect(country).toBeDefined();
    expect(country?.code).toBe('NG');
  });

  it('should return country by name (UPPERCASE)', () => {
    const country = getCountryByCode('NIGERIA');
    expect(country).toBeDefined();
    expect(country?.code).toBe('NG');
  });

  it('should return undefined for invalid code', () => {
    expect(getCountryByCode('ZZ')).toBeUndefined();
  });

  it('should return undefined for invalid name', () => {
    expect(getCountryByCode('Nowhere Land')).toBeUndefined();
  });

  it('should return undefined for empty string', () => {
    expect(getCountryByCode('')).toBeUndefined();
  });

  it('should return United States for "United States"', () => {
    const country = getCountryByCode('United States');
    expect(country?.code).toBe('US');
  });

  it('should return United Kingdom for "UK" if mapped? No, code is GB', () => {
    // Check if GB works
    const country = getCountryByCode('GB');
    expect(country?.name).toBe('United Kingdom');
  });
});
