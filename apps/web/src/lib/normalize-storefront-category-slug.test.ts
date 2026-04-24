import { describe, expect, it } from 'vitest';
import { normalizeStorefrontCategorySlug } from '@/lib/normalize-storefront-category-slug';

describe('normalizeStorefrontCategorySlug', () => {
  it('normalizes legacy/typo category slugs to canonical values', () => {
    expect(normalizeStorefrontCategorySlug('phone')).toBe('smartphones');
    expect(normalizeStorefrontCategorySlug('phones')).toBe('smartphones');
    expect(normalizeStorefrontCategorySlug('laptop')).toBe('laptops');
    expect(normalizeStorefrontCategorySlug('accesories')).toBe('accessories');
  });

  it('preserves merchant-defined brand slugs (samsung, macbook)', () => {
    // Brand-specific slugs must NOT be remapped — merchants may use these
    // as their own category slugs, and rewriting them would break links.
    expect(normalizeStorefrontCategorySlug('samsung')).toBe('samsung');
    expect(normalizeStorefrontCategorySlug('macbook')).toBe('macbook');
  });

  it('returns lowercase trimmed slug when no alias exists', () => {
    expect(normalizeStorefrontCategorySlug('  Gaming  ')).toBe('gaming');
  });

  it('returns null for empty inputs', () => {
    expect(normalizeStorefrontCategorySlug('')).toBeNull();
    expect(normalizeStorefrontCategorySlug('   ')).toBeNull();
    expect(normalizeStorefrontCategorySlug(undefined)).toBeNull();
  });
});
