import { describe, expect, it } from 'vitest';
import {
  buildStorefrontPageHref,
  getStorefrontCrawlDiscoveryPages,
  parseStorefrontPageParam,
  STOREFRONT_CRAWL_DISCOVERY_CATEGORY_PAGE_LIMIT,
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

describe('getStorefrontCrawlDiscoveryPages', () => {
  it('returns every page when the total is within the all-pages threshold', () => {
    expect(
      getStorefrontCrawlDiscoveryPages({
        totalPages: 6,
        allPagesThreshold: 20,
      })
    ).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('supports product indexes that need up to one hundred crawlable page links', () => {
    const pages = getStorefrontCrawlDiscoveryPages({
      totalPages: 64,
      allPagesThreshold: 100,
    });

    expect(pages).toHaveLength(64);
    expect(pages[0]).toBe(1);
    expect(pages.at(-1)).toBe(64);
  });

  it('fully links medium category indexes that remain in crawl-depth reports', () => {
    const pages = getStorefrontCrawlDiscoveryPages({
      totalPages: 27,
      allPagesThreshold: STOREFRONT_CRAWL_DISCOVERY_CATEGORY_PAGE_LIMIT,
    });

    expect(pages).toEqual(Array.from({ length: 27 }, (_, index) => index + 1));
  });

  it('caps very large page sets while keeping edge, current, jump, and required pages', () => {
    const pages = getStorefrontCrawlDiscoveryPages({
      totalPages: 240,
      currentPage: 120,
      requiredPages: [37, 199],
      allPagesThreshold: 100,
      maxPages: 30,
      jumpInterval: 25,
    });

    expect(pages.length).toBeLessThanOrEqual(30);
    expect(pages).toEqual([...pages].sort((left, right) => left - right));
    expect(pages).toEqual(
      expect.arrayContaining([1, 2, 10, 25, 37, 119, 120, 121, 199, 240])
    );
  });

  it('keeps the full discovery result bounded when mandatory pages exceed a small cap', () => {
    const pages = getStorefrontCrawlDiscoveryPages({
      totalPages: 240,
      currentPage: 120,
      requiredPages: [37, 199, 222],
      allPagesThreshold: 100,
      maxPages: 5,
      jumpInterval: 5,
    });

    expect(pages).toHaveLength(5);
    expect(pages).toEqual([...pages].sort((left, right) => left - right));
    expect(pages).toEqual(expect.arrayContaining([37, 120, 199, 222]));
  });

  it('sanitizes non-finite current windows so the page loop stays bounded', () => {
    const pages = getStorefrontCrawlDiscoveryPages({
      totalPages: 25,
      currentPage: 10,
      currentWindow: Number.POSITIVE_INFINITY,
      edgePageCount: 2,
      allPagesThreshold: 5,
      maxPages: 12,
    });

    expect(pages).toEqual([1, 2, 10, 20, 24, 25]);
  });

  it('floors fractional current windows instead of widening them unpredictably', () => {
    const pages = getStorefrontCrawlDiscoveryPages({
      totalPages: 30,
      currentPage: 10,
      currentWindow: 1.8,
      edgePageCount: 1,
      allPagesThreshold: 5,
      maxPages: 15,
    });

    expect(pages).toEqual(expect.arrayContaining([9, 10, 11]));
    expect(pages).not.toContain(8);
    expect(pages).not.toContain(12);
  });

  it('returns no discovery pages when there is only one page', () => {
    expect(getStorefrontCrawlDiscoveryPages({ totalPages: 1 })).toEqual([]);
  });
});
