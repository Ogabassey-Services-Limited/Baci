import { describe, expect, it } from 'vitest';
import {
  buildCanonicalPair,
  forEachComparePair,
} from './compare-link-graph-pairs';

const products = [
  { slug: 'xiaomi-13t', name: 'Xiaomi 13T' },
  { slug: 'google-pixel-8', name: 'Google Pixel 8' },
  { slug: 'iphone-17-pro-max', name: 'iPhone 17 Pro Max' },
];

describe('compare link graph pairs', () => {
  it('visits only anchor pairs when an anchor product is provided', () => {
    const visitedPairs: string[] = [];

    forEachComparePair(products, 'xiaomi-13t', (left, right) => {
      visitedPairs.push(`${left.slug}:${right.slug}`);
    });

    expect(visitedPairs).toEqual([
      'xiaomi-13t:google-pixel-8',
      'xiaomi-13t:iphone-17-pro-max',
    ]);
  });

  it('trims anchor slugs before matching products', () => {
    const visitedPairs: string[] = [];

    forEachComparePair(products, ' xiaomi-13t ', (left, right) => {
      visitedPairs.push(`${left.slug}:${right.slug}`);
    });

    expect(visitedPairs).toEqual([
      'xiaomi-13t:google-pixel-8',
      'xiaomi-13t:iphone-17-pro-max',
    ]);
  });

  it('visits every pair combination when no anchor product is provided', () => {
    const visitedPairs: string[] = [];

    forEachComparePair(products, undefined, (left, right) => {
      visitedPairs.push(`${left.slug}:${right.slug}`);
    });

    expect(visitedPairs).toEqual([
      'xiaomi-13t:google-pixel-8',
      'xiaomi-13t:iphone-17-pro-max',
      'google-pixel-8:iphone-17-pro-max',
    ]);
  });

  it('returns products in canonical comparison slug order', () => {
    expect(
      buildCanonicalPair({
        comparisonSlug: 'google-pixel-8-vs-xiaomi-13t',
        left: products[0],
        leftSlug: 'xiaomi-13t',
        right: products[1],
        rightSlug: 'google-pixel-8',
      })
    ).toMatchObject({
      leftSlug: 'google-pixel-8',
      rightSlug: 'xiaomi-13t',
    });
  });

  it('returns null when the comparison slug is not parseable', () => {
    expect(
      buildCanonicalPair({
        comparisonSlug: 'not-a-compare-slug',
        left: products[0],
        leftSlug: 'xiaomi-13t',
        right: products[1],
        rightSlug: 'google-pixel-8',
      })
    ).toBeNull();
  });

  it('returns null when the comparison slug does not match the provided pair', () => {
    expect(
      buildCanonicalPair({
        comparisonSlug: 'iphone-17-pro-max-vs-samsung-galaxy-s24-ultra',
        left: products[0],
        leftSlug: 'xiaomi-13t',
        right: products[1],
        rightSlug: 'google-pixel-8',
      })
    ).toBeNull();
  });
});
