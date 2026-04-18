import { describe, expect, it } from 'vitest';
import {
  buildCanonicalBrandCompareSlug,
  buildCanonicalProductCompareSlug,
  parseCompareSlug,
} from './compare-slugs';

describe('compare slug canonicalization', () => {
  it('orders product pairs deterministically', () => {
    expect(
      buildCanonicalProductCompareSlug(
        'iphone-17-pro-max',
        'samsung-galaxy-z-trifold'
      )
    ).toBe('iphone-17-pro-max-vs-samsung-galaxy-z-trifold');
  });

  it('orders brand pairs alphabetically', () => {
    expect(buildCanonicalBrandCompareSlug('Samsung', 'Apple')).toBe(
      'apple-vs-samsung'
    );
  });

  it('parses compare slugs into canonical compare keys', () => {
    expect(parseCompareSlug('apple-vs-samsung')).toMatchObject({
      leftKey: 'apple',
      rightKey: 'samsung',
      canonicalSlug: 'apple-vs-samsung',
    });
  });

  it('returns null for invalid compare slugs', () => {
    expect(parseCompareSlug('apple')).toBeNull();
  });
});
