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

  it('strips non-ASCII letters the same way product.category_slug is generated', () => {
    // Must match the slug shape stored in `products.category_slug`, which is
    // produced by `generateSlug` in normalize-product.ts. `generateSlug` uses
    // the ASCII-only `\w` class, so diacritic characters are removed entirely
    // rather than decomposed. Aligning here guarantees the related-products
    // lookup won't silently miss rows.
    expect(normalizeStorefrontCategoryValue('Prodüct Nëws')).toBe('prodct-nws');
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
