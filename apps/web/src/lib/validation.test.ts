import { describe, expect, it } from 'vitest';
import {
  isValidMerchantIdentifier,
  isValidMerchantSlug,
} from '@/lib/validation';

describe('validation reserved storefront paths', () => {
  it('accepts a normal merchant slug', () => {
    expect(isValidMerchantSlug('acme-store')).toBe(true);
    expect(isValidMerchantIdentifier('acme-store')).toBe(true);
  });

  it('rejects image asset namespace as a merchant slug', () => {
    expect(isValidMerchantSlug('images')).toBe(false);
    expect(isValidMerchantIdentifier('images')).toBe(false);
  });

  it('rejects the legacy singular product namespace as a merchant slug', () => {
    expect(isValidMerchantSlug('product')).toBe(false);
    expect(isValidMerchantIdentifier('product')).toBe(false);
  });
});
