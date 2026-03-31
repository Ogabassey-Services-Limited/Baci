import { describe, expect, it } from 'vitest';
import { isValidMerchantIdentifier, isValidMerchantSlug } from './validation';

describe('validation reserved storefront paths', () => {
  it('rejects image asset namespace as a merchant slug', () => {
    expect(isValidMerchantSlug('images')).toBe(false);
    expect(isValidMerchantIdentifier('images')).toBe(false);
  });

  it('rejects the legacy singular product namespace as a merchant slug', () => {
    expect(isValidMerchantSlug('product')).toBe(false);
    expect(isValidMerchantIdentifier('product')).toBe(false);
  });
});
