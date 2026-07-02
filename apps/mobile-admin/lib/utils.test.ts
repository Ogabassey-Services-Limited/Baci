import { describe, expect, it } from 'vitest';
import { normalizeMerchantCurrency as normalizeMerchantCurrencySource } from './merchant-currency';
import { normalizeMerchantCurrency } from './utils';

describe('utils currency exports', () => {
  it('keeps normalizeMerchantCurrency available from the legacy utils path', () => {
    expect(normalizeMerchantCurrency).toBe(normalizeMerchantCurrencySource);
  });
});
