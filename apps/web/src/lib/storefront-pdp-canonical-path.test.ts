import { describe, expect, it } from 'vitest';
import {
  buildStorefrontPdpCanonicalPath,
  normalizeStorefrontPdpPathForCompare,
  normalizeStorefrontPublicPdpPath,
  type StorefrontPdpCanonicalSource,
} from '@/lib/storefront-pdp-canonical-path';

function baseSource(
  overrides: Partial<StorefrontPdpCanonicalSource> = {}
): StorefrontPdpCanonicalSource {
  return {
    id: 'product-1',
    name: 'iPhone 15 Pro',
    slug: 'iphone-15-pro',
    ...overrides,
  };
}

describe('buildStorefrontPdpCanonicalPath', () => {
  it('composes /{categorySlug}/{slug} when categories.slug is present', () => {
    const source = baseSource({
      categories: { name: 'Smartphones', slug: 'smartphones' },
    });

    const path = buildStorefrontPdpCanonicalPath(source);

    expect(path).toBe('/smartphones/iphone-15-pro');
  });

  it('takes the first element when categories is an array', () => {
    const source = baseSource({
      categories: [
        { name: 'Accessories', slug: 'accessories' },
        { name: 'Other', slug: 'other' },
      ],
    });

    const path = buildStorefrontPdpCanonicalPath(source);

    expect(path).toBe('/accessories/iphone-15-pro');
  });

  it('falls back to the legacy category string when categories is null', () => {
    const source = baseSource({
      categories: null,
      category: 'Home & Kitchen',
    });

    const path = buildStorefrontPdpCanonicalPath(source);

    expect(path).toBe('/home-kitchen/iphone-15-pro');
  });

  it('falls back to the /products/{slug} shape when both category fields are absent', () => {
    const source = baseSource({ categories: null, category: null });

    const path = buildStorefrontPdpCanonicalPath(source);

    expect(path).toBe('/products/iphone-15-pro');
  });

  it('ignores a stale canonical_url on the source', () => {
    const source = baseSource({
      canonical_url: '/x/y',
      categories: { name: 'Smartphones', slug: 'smartphones' },
    });

    const path = buildStorefrontPdpCanonicalPath(source);

    expect(path).toBe('/smartphones/iphone-15-pro');
    expect(path).not.toBe('/x/y');
  });
});

describe('normalizeStorefrontPublicPdpPath', () => {
  it('normalizes known public category aliases on 2-segment paths', () => {
    expect(normalizeStorefrontPublicPdpPath('/phones/iphone-15-pro')).toBe(
      '/smartphones/iphone-15-pro'
    );
    expect(normalizeStorefrontPublicPdpPath('/phone/iphone-15-pro')).toBe(
      '/smartphones/iphone-15-pro'
    );
    expect(normalizeStorefrontPublicPdpPath('/accesories/case')).toBe(
      '/accessories/case'
    );
    expect(normalizeStorefrontPublicPdpPath('/laptop/macbook-air')).toBe(
      '/laptops/macbook-air'
    );
  });

  it('leaves non-alias 2-segment category paths untouched', () => {
    expect(normalizeStorefrontPublicPdpPath('/smartphones/iphone-15-pro')).toBe(
      '/smartphones/iphone-15-pro'
    );
  });

  it('strips query strings and hashes before normalizing', () => {
    const path = normalizeStorefrontPublicPdpPath(
      '/phones/iphone-15-pro?ref=abc#section'
    );

    expect(path).toBe('/smartphones/iphone-15-pro');
  });

  it('strips a trailing slash on a 2-segment path as part of alias normalization', () => {
    const path = normalizeStorefrontPublicPdpPath('/phones/iphone-15-pro/');

    expect(path).toBe('/smartphones/iphone-15-pro');
  });

  it('only strips trailing slashes for non-2-segment paths, without alias normalization', () => {
    expect(normalizeStorefrontPublicPdpPath('/about/')).toBe('/about');
    expect(
      normalizeStorefrontPublicPdpPath('/phones/iphone-15-pro/extra/')
    ).toBe('/phones/iphone-15-pro/extra');
  });

  it('returns the root path unchanged', () => {
    expect(normalizeStorefrontPublicPdpPath('/')).toBe('/');
  });
});

describe('normalizeStorefrontPdpPathForCompare', () => {
  it('lowercases the normalized path', () => {
    const path = normalizeStorefrontPdpPathForCompare('/Phones/IPhone-15-Pro');

    expect(path).toBe('/smartphones/iphone-15-pro');
  });
});
