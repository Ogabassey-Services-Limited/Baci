import { describe, expect, it } from 'vitest';
import { normalizeMerchantCurrency } from './utils';

describe('normalizeMerchantCurrency', () => {
  it('normalizes merchant currency codes before returning them', () => {
    expect(normalizeMerchantCurrency('ngn')).toBe('NGN');
    expect(normalizeMerchantCurrency(' usd ')).toBe('USD');
  });

  it('returns undefined for blank or invalid currency codes', () => {
    expect(normalizeMerchantCurrency('   ')).toBeUndefined();
    expect(normalizeMerchantCurrency('INVALID')).toBeUndefined();
  });
});
