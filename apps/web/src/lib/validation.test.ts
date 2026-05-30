import { describe, expect, it } from 'vitest';
import {
  isRoutePlaceholder,
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

describe('isRoutePlaceholder', () => {
  it('identifies dynamic route placeholders correctly', () => {
    expect(isRoutePlaceholder('[slug]')).toBe(true);
    expect(isRoutePlaceholder('[productSlug]')).toBe(true);
    expect(isRoutePlaceholder('  [slug]  ')).toBe(true);
  });

  it('rejects non-placeholders', () => {
    expect(isRoutePlaceholder('slug')).toBe(false);
    expect(isRoutePlaceholder('[slug')).toBe(false);
    expect(isRoutePlaceholder('slug]')).toBe(false);
    expect(isRoutePlaceholder('')).toBe(false);
    expect(isRoutePlaceholder(null)).toBe(false);
    expect(isRoutePlaceholder(undefined)).toBe(false);
  });
});

describe('isValidMerchantIdentifier with route placeholders', () => {
  it('accepts a dynamic route placeholder as valid', () => {
    expect(isValidMerchantIdentifier('[slug]')).toBe(true);
    expect(isValidMerchantIdentifier('[merchant_id]')).toBe(true);
  });

  it('accepts valid domains', () => {
    expect(isValidMerchantIdentifier('example.com')).toBe(true);
    expect(isValidMerchantIdentifier('store.mybrand.ng')).toBe(true);
  });

  it('rejects invalid inputs', () => {
    expect(isValidMerchantIdentifier('')).toBe(false);
    expect(isValidMerchantIdentifier('invalid_slug!')).toBe(false);
  });
});
