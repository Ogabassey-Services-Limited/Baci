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

  it('returns undefined for malformed canonical urls so callers can fall back', () => {
    expect(
      normalizeStorefrontCanonicalUrl('https://%', 'https://ogabassey.com')
    ).toBeUndefined();
  });

  it('resolves relative canonicals against the storefront base url', () => {
    expect(
      normalizeStorefrontCanonicalUrl(
        '/products/iphone-17-pro-max?ref=seo#specs',
        'https://ogabassey.com'
      )
    ).toBe('https://ogabassey.com/products/iphone-17-pro-max?ref=seo#specs');
  });

  it('preserves query strings and fragments when rewriting canonical origins', () => {
    expect(
      normalizeStorefrontCanonicalUrl(
        'https://usebaci.com/smartphones/samsung-galaxy-z-fold-6-12gb-256gb?src=google#reviews',
        'https://ogabassey.com'
      )
    ).toBe(
      'https://ogabassey.com/smartphones/samsung-galaxy-z-fold-6-12gb-256gb?src=google#reviews'
    );
  });

  it('strips path-mode merchant prefixes when rewriting to a custom domain', () => {
    expect(
      normalizeStorefrontCanonicalUrl(
        'https://usebaci.com/ogabassey/smartphones/iphone-15-pro-max',
        'https://ogabassey.com',
        'ogabassey'
      )
    ).toBe('https://ogabassey.com/smartphones/iphone-15-pro-max');
  });

  it('preserves trailing slashes when stripping a path-mode merchant prefix', () => {
    expect(
      normalizeStorefrontCanonicalUrl(
        'https://usebaci.com/ogabassey/smartphones/',
        'https://ogabassey.com',
        'ogabassey'
      )
    ).toBe('https://ogabassey.com/smartphones/');
  });

  it('rewrites exact merchant-prefixed roots to the storefront root', () => {
    expect(
      normalizeStorefrontCanonicalUrl(
        'https://usebaci.com/ogabassey',
        'https://ogabassey.com',
        'ogabassey'
      )
    ).toBe('https://ogabassey.com/');
  });

  it('rewrites trailing-slash merchant roots to the storefront root', () => {
    expect(
      normalizeStorefrontCanonicalUrl(
        'https://usebaci.com/ogabassey/',
        'https://ogabassey.com',
        'ogabassey'
      )
    ).toBe('https://ogabassey.com/');
  });

  it('preserves merchant strings outside the leading path segment', () => {
    expect(
      normalizeStorefrontCanonicalUrl(
        'https://usebaci.com/products/iphone-15?merchant=ogabassey#ogabassey',
        'https://ogabassey.com',
        'ogabassey'
      )
    ).toBe(
      'https://ogabassey.com/products/iphone-15?merchant=ogabassey#ogabassey'
    );
  });

  it('strips merchant prefixes case-insensitively when rewriting origins', () => {
    expect(
      normalizeStorefrontCanonicalUrl(
        'https://usebaci.com/OgaBassey/products/iphone-15',
        'https://ogabassey.com',
        'ogabassey'
      )
    ).toBe('https://ogabassey.com/products/iphone-15');
  });

  it('keeps the path unchanged when merchant slug is empty', () => {
    expect(
      normalizeStorefrontCanonicalUrl(
        'https://usebaci.com/products/iphone-15',
        'https://ogabassey.com',
        ''
      )
    ).toBe('https://ogabassey.com/products/iphone-15');
  });

  it('strips merchant prefixes safely when the slug contains punctuation', () => {
    expect(
      normalizeStorefrontCanonicalUrl(
        'https://usebaci.com/shop.name/products/iphone-15',
        'https://shop.example.com',
        'shop.name'
      )
    ).toBe('https://shop.example.com/products/iphone-15');
  });

  it('treats punctuation-bearing merchant slugs literally for near-miss paths', () => {
    expect(
      normalizeStorefrontCanonicalUrl(
        'https://usebaci.com/shopXname/products/iphone-15',
        'https://shop.example.com',
        'shop.name'
      )
    ).toBe('https://shop.example.com/shopXname/products/iphone-15');
  });

  it('preserves rewritten paths that do not begin with the merchant slug', () => {
    expect(
      normalizeStorefrontCanonicalUrl(
        'https://usebaci.com/smartphones/ogabassey-special',
        'https://ogabassey.com',
        'ogabassey'
      )
    ).toBe('https://ogabassey.com/smartphones/ogabassey-special');
  });

  it('handles different ports and schemes when rewriting canonical origins', () => {
    expect(
      normalizeStorefrontCanonicalUrl(
        'http://localhost:3000/products/iphone-15',
        'https://ogabassey.com'
      )
    ).toBe('https://ogabassey.com/products/iphone-15');

    expect(
      normalizeStorefrontCanonicalUrl(
        'https://usebaci.com:8443/products/iphone-15',
        'https://ogabassey.com'
      )
    ).toBe('https://ogabassey.com/products/iphone-15');
  });

  it('handles null/undefined input', () => {
    expect(
      normalizeStorefrontCanonicalUrl(null, 'https://ogabassey.com')
    ).toBeUndefined();
    expect(
      normalizeStorefrontCanonicalUrl(undefined, 'https://ogabassey.com')
    ).toBeUndefined();
  });
});
