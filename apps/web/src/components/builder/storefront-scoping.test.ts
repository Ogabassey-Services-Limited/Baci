import { describe, expect, it } from 'vitest';
import { getStorefrontScopedHref } from './storefront-scoping';

describe('getStorefrontScopedHref', () => {
  describe('passthrough cases (no scoping)', () => {
    it('returns the URL unchanged when no basePath is set', () => {
      expect(getStorefrontScopedHref('/products', undefined)).toBe('/products');
      expect(getStorefrontScopedHref('/products', null)).toBe('/products');
      expect(getStorefrontScopedHref('/products', '')).toBe('/products');
    });

    it('leaves anchor links unchanged', () => {
      expect(getStorefrontScopedHref('#products', '/style-store')).toBe(
        '#products'
      );
    });

    it('leaves protocol URLs unchanged', () => {
      expect(
        getStorefrontScopedHref('https://example.com', '/style-store')
      ).toBe('https://example.com');
      expect(
        getStorefrontScopedHref('mailto:hi@example.com', '/style-store')
      ).toBe('mailto:hi@example.com');
      expect(
        getStorefrontScopedHref('tel:+2348012345678', '/style-store')
      ).toBe('tel:+2348012345678');
    });

    it('leaves protocol-relative URLs unchanged', () => {
      expect(
        getStorefrontScopedHref('//cdn.example.com/img', '/style-store')
      ).toBe('//cdn.example.com/img');
    });

    it('leaves relative (non-rooted) URLs unchanged', () => {
      expect(getStorefrontScopedHref('products', '/style-store')).toBe(
        'products'
      );
    });

    it('leaves empty / whitespace-only URLs unchanged after trim', () => {
      expect(getStorefrontScopedHref('', '/style-store')).toBe('');
      expect(getStorefrontScopedHref('   ', '/style-store')).toBe('');
    });
  });

  describe('idempotency', () => {
    it('does not double-prefix when URL already starts with basePath', () => {
      expect(
        getStorefrontScopedHref('/style-store/products', '/style-store')
      ).toBe('/style-store/products');
    });

    it('does not prefix when URL is exactly the basePath', () => {
      expect(getStorefrontScopedHref('/style-store', '/style-store')).toBe(
        '/style-store'
      );
    });

    it('treats basePath="/" as a no-op', () => {
      expect(getStorefrontScopedHref('/products', '/')).toBe('/products');
      expect(getStorefrontScopedHref('/', '/')).toBe('/');
    });
  });

  describe('scoping (prepends basePath)', () => {
    it('prefixes simple internal paths', () => {
      expect(getStorefrontScopedHref('/products', '/style-store')).toBe(
        '/style-store/products'
      );
    });

    it('prefixes nested internal paths', () => {
      expect(getStorefrontScopedHref('/category/decor', '/style-store')).toBe(
        '/style-store/category/decor'
      );
    });

    it('maps "/" to the bare basePath (no trailing slash)', () => {
      expect(getStorefrontScopedHref('/', '/style-store')).toBe('/style-store');
    });

    it('trims surrounding whitespace before scoping', () => {
      expect(getStorefrontScopedHref('  /contact  ', '/style-store')).toBe(
        '/style-store/contact'
      );
    });
  });
});
