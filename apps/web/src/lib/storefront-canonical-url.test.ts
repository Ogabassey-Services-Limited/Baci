import { describe, expect, it } from 'vitest';
import { canonicalizeCategorySlug } from '@/lib/storefront-canonical-url';

describe('canonicalizeCategorySlug', () => {
  it('lowercases mixed-case slugs', () => {
    expect(canonicalizeCategorySlug('Samsung')).toBe('samsung');
    expect(canonicalizeCategorySlug('SmartPhones')).toBe('smartphones');
  });

  it('trims surrounding whitespace', () => {
    expect(canonicalizeCategorySlug('  laptops  ')).toBe('laptops');
  });

  it('returns null for empty or whitespace-only values', () => {
    expect(canonicalizeCategorySlug('')).toBeNull();
    expect(canonicalizeCategorySlug('   ')).toBeNull();
    expect(canonicalizeCategorySlug(null)).toBeNull();
    expect(canonicalizeCategorySlug(undefined)).toBeNull();
  });

  it('preserves internal characters (merchant-defined slug shape)', () => {
    // Unlike aggressive slugifiers, internal punctuation/hyphens are kept
    expect(canonicalizeCategorySlug('home-and-garden')).toBe('home-and-garden');
    expect(canonicalizeCategorySlug('PS5_accessories')).toBe('ps5_accessories');
  });

  it('preserves numeric tokens', () => {
    expect(canonicalizeCategorySlug('2026')).toBe('2026');
  });
});
