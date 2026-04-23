import { describe, expect, it } from 'vitest';
import { normalizeStorefrontCategorySlug } from '@/lib/normalize-storefront-category-slug';

describe('normalizeStorefrontCategorySlug', () => {
  it('normalizes storefront aliases to canonical category slugs', () => {
    expect(normalizeStorefrontCategorySlug('samsung')).toBe('smartphones');
    expect(normalizeStorefrontCategorySlug('phones')).toBe('smartphones');
    expect(normalizeStorefrontCategorySlug('macbook')).toBe('laptops');
    expect(normalizeStorefrontCategorySlug('laptop')).toBe('laptops');
    expect(normalizeStorefrontCategorySlug('accesories')).toBe('accessories');
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
