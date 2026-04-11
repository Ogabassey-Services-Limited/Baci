import { describe, expect, it } from 'vitest';
import {
  normalizeCacSearchTerm,
  parseCacRegistration,
} from './cac-registration';

describe('parseCacRegistration', () => {
  it('preserves prefixed RC identifiers and strips separators', () => {
    expect(parseCacRegistration('rc-738 9159')).toEqual({
      canonicalSearchTerm: 'RC7389159',
      digits: '7389159',
      prefix: 'RC',
    });
  });

  it('applies a fallback prefix for digits-only identifiers', () => {
    expect(parseCacRegistration('738-9159', 'BN')).toEqual({
      canonicalSearchTerm: 'BN7389159',
      digits: '7389159',
      prefix: 'BN',
    });
  });

  it('returns null for company-name searches', () => {
    expect(parseCacRegistration('Baci Technologies Ltd')).toBeNull();
  });

  it('returns null for empty, whitespace, or missing values', () => {
    expect(parseCacRegistration('')).toBeNull();
    expect(parseCacRegistration('   ')).toBeNull();
    expect(parseCacRegistration(null)).toBeNull();
    expect(parseCacRegistration(undefined)).toBeNull();
  });

  it('canonicalizes mixed-case prefixes consistently', () => {
    expect(parseCacRegistration('rc-123')).toEqual({
      canonicalSearchTerm: 'RC123',
      digits: '123',
      prefix: 'RC',
    });
    expect(parseCacRegistration('Rc-123')).toEqual({
      canonicalSearchTerm: 'RC123',
      digits: '123',
      prefix: 'RC',
    });
    expect(parseCacRegistration('RC-123')).toEqual({
      canonicalSearchTerm: 'RC123',
      digits: '123',
      prefix: 'RC',
    });
  });

  it('returns null when special characters make the identifier invalid', () => {
    expect(parseCacRegistration('RC-12@#3')).toBeNull();
  });

  it('keeps long numeric identifiers intact when they still match the contract', () => {
    expect(parseCacRegistration('BN-1234-5678-9012-3456')).toEqual({
      canonicalSearchTerm: 'BN1234567890123456',
      digits: '1234567890123456',
      prefix: 'BN',
    });
  });
});

describe('normalizeCacSearchTerm', () => {
  it('keeps prefixed identifiers canonicalized instead of stripping the prefix', () => {
    expect(normalizeCacSearchTerm('BN 123456')).toBe('BN123456');
  });

  it('falls back to a trimmed free-text search when the input is not a registration identifier', () => {
    expect(normalizeCacSearchTerm('  Baci Tech  ')).toBe('Baci Tech');
  });
});
