import { describe, expect, it } from 'vitest';
import { normalizeStorefrontCategoryValue } from '@/lib/normalize-storefront-category-value';

describe('normalizeStorefrontCategoryValue', () => {
  it('slugifies free-text category values', () => {
    expect(normalizeStorefrontCategoryValue(' Product News ')).toBe(
      'product-news'
    );
  });

  it('returns null for empty inputs', () => {
    expect(normalizeStorefrontCategoryValue('')).toBeNull();
    expect(normalizeStorefrontCategoryValue('   ')).toBeNull();
    expect(normalizeStorefrontCategoryValue(null)).toBeNull();
    expect(normalizeStorefrontCategoryValue(undefined)).toBeNull();
  });

  it('removes special characters while keeping slug separators stable', () => {
    expect(normalizeStorefrontCategoryValue('Product & News!')).toBe(
      'product-news'
    );
  });

  it('collapses repeated spaces into a single slug separator', () => {
    expect(normalizeStorefrontCategoryValue('Product  News')).toBe(
      'product-news'
    );
  });

  it('normalizes non-ascii separators down to an ascii slug', () => {
    expect(normalizeStorefrontCategoryValue('Prodüct Nëws')).toBe(
      'product-news'
    );
  });

  it('lowercases mixed-case values', () => {
    expect(normalizeStorefrontCategoryValue('GaMiNg')).toBe('gaming');
  });

  it('trims leading and trailing separators', () => {
    expect(normalizeStorefrontCategoryValue('---Product News---')).toBe(
      'product-news'
    );
  });

  it('preserves numeric and alphanumeric category tokens', () => {
    expect(normalizeStorefrontCategoryValue('PS5 Accessories')).toBe(
      'ps5-accessories'
    );
    expect(normalizeStorefrontCategoryValue('2026')).toBe('2026');
  });

  it('returns null when only removable characters are provided', () => {
    expect(normalizeStorefrontCategoryValue('***')).toBeNull();
  });
});
