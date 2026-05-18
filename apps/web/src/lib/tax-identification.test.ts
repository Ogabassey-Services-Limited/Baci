import { describe, expect, it } from 'vitest';
import {
  isValidTaxIdentificationNumber,
  normalizeTaxIdentificationNumber,
} from './tax-identification';

describe('tax identification utilities', () => {
  it('normalizes user-entered TIN values to digits only', () => {
    expect(normalizeTaxIdentificationNumber(' 252-259-9781276 ')).toBe(
      '2522599781276'
    );
  });

  it('accepts legacy 10-digit and CAC-returned 13-digit TIN values', () => {
    expect(isValidTaxIdentificationNumber('1234567890')).toBe(true);
    expect(isValidTaxIdentificationNumber('2522599781276')).toBe(true);
  });

  it('rejects values that are too short or too long', () => {
    expect(isValidTaxIdentificationNumber('123456789')).toBe(false);
    expect(isValidTaxIdentificationNumber('1234567890123456')).toBe(false);
  });
});
