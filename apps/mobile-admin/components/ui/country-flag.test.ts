import { describe, expect, it } from 'vitest';
import { countryFlag } from './country-flag';

describe('countryFlag', () => {
  it('prefers an explicit flag', () => {
    expect(countryFlag({ code: 'NG', flag: 'custom' })).toBe('custom');
  });

  it('derives a flag from a valid two-letter country code', () => {
    expect(countryFlag({ code: 'gh' })).toBe('🇬🇭');
  });

  it('returns no flag for an invalid country code', () => {
    expect(countryFlag({ code: 'INVALID' })).toBe('');
  });
});
