import { describe, expect, it } from 'vitest';
import {
  canonicalizeCategorySlug,
  normalizeStorefrontCanonicalUrl,
} from '@/lib/storefront-canonical-url';

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

describe('normalizeStorefrontCanonicalUrl', () => {
  it('returns undefined when canonical url is empty', () => {
    expect(
      normalizeStorefrontCanonicalUrl('   ', 'https://ogabassey.com')
    ).toBeUndefined();
  });

  it('rewrites canonical origin to storefront origin when hosts differ', () => {
    expect(
      normalizeStorefrontCanonicalUrl(
        'https://usebaci.com/smartphones/samsung-galaxy-z-fold-6-12gb-256gb',
        'https://ogabassey.com'
      )
    ).toBe(
      'https://ogabassey.com/smartphones/samsung-galaxy-z-fold-6-12gb-256gb'
    );
  });

  it('keeps canonical url when host already matches', () => {
    expect(
      normalizeStorefrontCanonicalUrl(
        'https://ogabassey.com/laptops/macbook-pro-m2-max-32gb-1tb-14-inch',
        'https://ogabassey.com'
      )
    ).toBe('https://ogabassey.com/laptops/macbook-pro-m2-max-32gb-1tb-14-inch');
  });
});
