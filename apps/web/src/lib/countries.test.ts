import { describe, expect, it } from 'vitest';
import { getCountryByCode } from './countries';

describe('getCountryByCode', () => {
  it('should return country by uppercase code', () => {
    const country = getCountryByCode('NG');
    expect(country).toBeDefined();
    expect(country?.name).toBe('Nigeria');
    expect(country?.code).toBe('NG');
  });

  it('should return country by lowercase code', () => {
    const country = getCountryByCode('ng');
    expect(country).toBeDefined();
    expect(country?.name).toBe('Nigeria');
    expect(country?.code).toBe('NG');
  });

  it('should return country by mixed case code', () => {
    const country = getCountryByCode('Ng');
    expect(country).toBeDefined();
    expect(country?.name).toBe('Nigeria');
    expect(country?.code).toBe('NG');
  });

  it('should return country by exact name', () => {
    const country = getCountryByCode('United States');
    expect(country).toBeDefined();
    expect(country?.name).toBe('United States');
    expect(country?.code).toBe('US');
  });

  it('should return country by lowercase name', () => {
    const country = getCountryByCode('united states');
    expect(country).toBeDefined();
    expect(country?.name).toBe('United States');
    expect(country?.code).toBe('US');
  });

  it('should return country by mixed case name', () => {
    const country = getCountryByCode('United states');
    expect(country).toBeDefined();
    expect(country?.name).toBe('United States');
    expect(country?.code).toBe('US');
  });

  it('should return undefined for invalid code/name', () => {
    const country = getCountryByCode('XX');
    expect(country).toBeUndefined();
  });

  it('should return undefined for empty string', () => {
    const country = getCountryByCode('');
    expect(country).toBeUndefined();
  });

  // @ts-expect-error - simulating js call with null/undefined if possible
  it('should return undefined for null/undefined', () => {
    // @ts-expect-error
    expect(getCountryByCode(null)).toBeUndefined();
    // @ts-expect-error
    expect(getCountryByCode(undefined)).toBeUndefined();
  });
});
