import { describe, expect, it } from 'vitest';
import {
  buildStorefrontPageHref,
  parseStorefrontPageParam,
  STOREFRONT_PRODUCTS_PER_PAGE,
} from '@/lib/storefront-pagination';

describe('STOREFRONT_PRODUCTS_PER_PAGE', () => {
  it('equals 20', () => {
    expect(STOREFRONT_PRODUCTS_PER_PAGE).toBe(20);
  });
});

describe('parseStorefrontPageParam', () => {
  it('returns 1 when pageParam is null', () => {
    expect(parseStorefrontPageParam(null)).toBe(1);
  });

  it('returns 1 when pageParam is undefined', () => {
    expect(parseStorefrontPageParam(undefined)).toBe(1);
  });

  it('returns 1 when pageParam is an empty string', () => {
    expect(parseStorefrontPageParam('')).toBe(1);
  });

  it('returns null when pageParam is an array', () => {
    expect(parseStorefrontPageParam(['1', '2'])).toBeNull();
  });

  it('returns null for an empty array', () => {
    expect(parseStorefrontPageParam([])).toBeNull();
  });

  it('parses a valid numeric string', () => {
    expect(parseStorefrontPageParam('3')).toBe(3);
  });

  it('returns 1 for page "1"', () => {
    expect(parseStorefrontPageParam('1')).toBe(1);
  });

  it('returns null for non-numeric strings', () => {
    expect(parseStorefrontPageParam('abc')).toBeNull();
  });

  it('returns null for negative numbers', () => {
    expect(parseStorefrontPageParam('-1')).toBeNull();
  });

  it('returns null for zero', () => {
    expect(parseStorefrontPageParam('0')).toBeNull();
  });

  it('returns null for decimal numbers', () => {
    expect(parseStorefrontPageParam('1.5')).toBeNull();
  });

  it('returns null for strings with spaces', () => {
    expect(parseStorefrontPageParam(' 3 ')).toBeNull();
  });

  it('returns null for strings with leading zeros that contain non-digits', () => {
    expect(parseStorefrontPageParam('0x10')).toBeNull();
  });

  it('parses large valid page numbers', () => {
    expect(parseStorefrontPageParam('999')).toBe(999);
  });
});

describe('buildStorefrontPageHref', () => {
  it('returns basePath for page 1', () => {
    expect(buildStorefrontPageHref('/store/products', 1)).toBe(
      '/store/products'
    );
  });

  it('returns basePath for page 0 (treated as <= 1)', () => {
    expect(buildStorefrontPageHref('/store/products', 0)).toBe(
      '/store/products'
    );
  });

  it('appends ?page= for page > 1', () => {
    expect(buildStorefrontPageHref('/store/products', 2)).toBe(
      '/store/products?page=2'
    );
  });

  it('appends ?page= for large page numbers', () => {
    expect(buildStorefrontPageHref('/store/products', 100)).toBe(
      '/store/products?page=100'
    );
  });

  it('handles basePath with trailing slash', () => {
    expect(buildStorefrontPageHref('/store/', 3)).toBe('/store/?page=3');
  });

  it('handles empty basePath', () => {
    expect(buildStorefrontPageHref('', 1)).toBe('');
    expect(buildStorefrontPageHref('', 2)).toBe('?page=2');
  });

  it('preserves existing query params when adding a page', () => {
    expect(buildStorefrontPageHref('/store/products?sort=price-desc', 2)).toBe(
      '/store/products?sort=price-desc&page=2'
    );
  });

  it('replaces an existing page query param instead of duplicating it', () => {
    expect(
      buildStorefrontPageHref('/store/products?sort=price-desc&page=4', 2)
    ).toBe('/store/products?sort=price-desc&page=2');
  });

  it('preserves hash fragments when adding a page', () => {
    expect(buildStorefrontPageHref('/store/products#catalog', 3)).toBe(
      '/store/products?page=3#catalog'
    );
  });

  it('preserves existing query params and hash fragment together when adding a page', () => {
    expect(buildStorefrontPageHref('/store/products?sort=asc#catalog', 3)).toBe(
      '/store/products?sort=asc&page=3#catalog'
    );
  });
});
