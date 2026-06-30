import { describe, expect, it } from 'vitest';
import { isRawDbProductRecord } from '@/lib/normalize-product';
import {
  buildCanonicalCompareCategories,
  getStorefrontPathPrefix,
  sortCompareSections,
  toRequestRelativeHref,
} from './compare-page-content-helpers';

describe('compare page content helpers', () => {
  it('uses no path prefix for custom-domain storefront requests', () => {
    expect(
      getStorefrontPathPrefix(new Headers([['x-custom-domain', '1']]), 'store')
    ).toBe('');
  });

  it('keeps platform paths scoped to the merchant slug without double-prefixing development URLs', () => {
    expect(
      toRequestRelativeHref(
        'https://ogabassey.usebaci.com/laptops/compare/a-vs-b',
        'https://ogabassey.usebaci.com',
        '/ogabassey'
      )
    ).toBe('/ogabassey/laptops/compare/a-vs-b');
    expect(
      toRequestRelativeHref(
        'http://localhost:3000/ogabassey/laptops/compare/a-vs-b',
        'http://localhost:3000/ogabassey',
        '/ogabassey'
      )
    ).toBe('/ogabassey/laptops/compare/a-vs-b');
  });

  it('keeps malformed and cross-origin compare URLs unchanged', () => {
    expect(
      toRequestRelativeHref(
        'https://%',
        'https://ogabassey.usebaci.com',
        '/ogabassey'
      )
    ).toBe('https://%');
    expect(
      toRequestRelativeHref(
        'https://example.com/laptops/compare/a-vs-b',
        'https://ogabassey.usebaci.com',
        '/ogabassey'
      )
    ).toBe('https://example.com/laptops/compare/a-vs-b');
  });

  it('dedupes categories by canonical slug', () => {
    expect(
      buildCanonicalCompareCategories([
        { name: 'Laptops', slug: ' Laptops ' },
        { name: 'Laptop duplicates', slug: 'laptops' },
        { name: 'Audio', slug: 'audio' },
        { name: 'Invalid', slug: '' },
      ])
    ).toEqual([
      { name: 'Laptop duplicates', slug: 'laptops', categorySlug: 'laptops' },
      { name: 'Audio', slug: 'audio', categorySlug: 'audio' },
    ]);
  });

  it('narrows raw product records before normalization', () => {
    expect(
      isRawDbProductRecord({
        id: 'product-1',
        name: 'Product',
        price: 1000,
      })
    ).toBe(true);
    expect(isRawDbProductRecord({ name: 'Missing id', price: 1000 })).toBe(
      false
    );
  });

  it('sorts compare sections by link count before label', () => {
    expect(
      [
        {
          categoryName: 'Audio',
          categorySlug: 'audio',
          links: [{ href: '/a', label: 'A' }],
        },
        {
          categoryName: 'Laptops',
          categorySlug: 'laptops',
          links: [
            { href: '/b', label: 'B' },
            { href: '/c', label: 'C' },
          ],
        },
        {
          categoryName: 'Accessories',
          categorySlug: 'accessories',
          links: [{ href: '/d', label: 'D' }],
        },
      ].sort(sortCompareSections)
    ).toEqual([
      {
        categoryName: 'Laptops',
        categorySlug: 'laptops',
        links: [
          { href: '/b', label: 'B' },
          { href: '/c', label: 'C' },
        ],
      },
      {
        categoryName: 'Accessories',
        categorySlug: 'accessories',
        links: [{ href: '/d', label: 'D' }],
      },
      {
        categoryName: 'Audio',
        categorySlug: 'audio',
        links: [{ href: '/a', label: 'A' }],
      },
    ]);
  });
});
