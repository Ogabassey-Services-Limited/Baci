import { describe, expect, it } from 'vitest';
import { buildClusterGuideSearchQuery } from './build-cluster-guide-search-query';

describe('buildClusterGuideSearchQuery', () => {
  it('prioritizes category and page-specific commercial context', () => {
    const query = buildClusterGuideSearchQuery({
      pageKind: 'price-band',
      categorySlug: 'smartphones',
      brands: ['Apple'],
      priceBandSlug: 'under-300k',
      productSlugs: ['iphone-15-pro-max'],
    });

    expect(query).toContain('"smartphones"');
    expect(query).toContain('"apple"');
    expect(query).toContain('"iphone 15 pro max"');
    expect(query).toContain('"budget"');
    expect(query).toContain(' OR ');
  });

  it('quotes normalized terms so untrusted context cannot inject search operators', () => {
    const query = buildClusterGuideSearchQuery({
      pageKind: 'product',
      categorySlug: 'smartphones',
      brands: ['" OR password:*'],
      productSlugs: ['pixel-8)\nOR-(secret'],
    });

    expect(query).not.toContain('password:*');
    expect(query).not.toContain(')');
    expect(query).not.toContain('\n');
    expect(query.split(' OR ')).toEqual(
      expect.arrayContaining(['"password"', '"pixel 8 secret"'])
    );
    expect(query.split(' OR ').every((term) => /^"[^"\\]+"$/u.test(term))).toBe(
      true
    );
  });

  it('deduplicates terms and never truncates a quoted expression', () => {
    const query = buildClusterGuideSearchQuery({
      pageKind: 'compare',
      categorySlug: 'smartphones',
      brands: Array.from({ length: 80 }, (_, index) => `Móbílè ${index}`),
      productSlugs: Array.from(
        { length: 80 },
        (_, index) => `phone-model-${index}`
      ),
    });
    const terms = query.split(' OR ');

    expect(query.length).toBeLessThanOrEqual(512);
    expect(new TextEncoder().encode(query).byteLength).toBeLessThanOrEqual(512);
    expect(new Set(terms).size).toBe(terms.length);
    expect(terms.every((term) => /^"[^"\\]+"$/u.test(term))).toBe(true);
    expect(query.endsWith('"')).toBe(true);
  });

  it('spreads compact category product markers across the bounded query', () => {
    const productSlugs = Array.from(
      { length: 40 },
      (_, index) => `itel-model-${String(index + 1).padStart(2, '0')}`
    );
    const query = buildClusterGuideSearchQuery({
      pageKind: 'category',
      categorySlug: 'smartphones',
      brands: ['Itel'],
      productSlugs,
    });

    expect(query).toContain('"01"');
    expect(query).toContain('"20"');
    expect(query).toContain('"40"');
    expect(query).not.toContain('"itel model 01"');
    expect(new TextEncoder().encode(query).byteLength).toBeLessThanOrEqual(512);
  });
});
