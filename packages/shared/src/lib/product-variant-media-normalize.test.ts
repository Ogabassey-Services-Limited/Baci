import { describe, expect, it } from 'vitest';
import {
  normalizeColorImages,
  normalizeColorName,
  normalizeImageUrl,
  normalizeProductColors,
  normalizeProductImages,
} from './product-variant-media-normalize';

describe('normalizeColorName', () => {
  it('returns an empty string for non-string input', () => {
    expect(normalizeColorName(null)).toBe('');
    expect(normalizeColorName(undefined)).toBe('');
  });

  it('trims whitespace', () => {
    expect(normalizeColorName('  Black  ')).toBe('Black');
  });

  it('strips a single pair of surrounding quotes', () => {
    expect(normalizeColorName('"Black"')).toBe('Black');
    expect(normalizeColorName("'Gold'")).toBe('Gold');
  });

  it('strips repeated outer quotes produced by JSON serialization round-trips', () => {
    // Regression: JSON persistence paths sometimes double-encode a string.
    expect(normalizeColorName('""Black""')).toBe('Black');
    expect(normalizeColorName('"\'Black\'"')).toBe('Black');
  });

  it('preserves inner quotes', () => {
    // Only OUTER quotes are stripped; inner quotes remain (defensive — no
    // sane color name contains quotes, but the stripping must not eat them).
    expect(normalizeColorName('Rich"Black')).toBe('Rich"Black');
  });
});

describe('normalizeImageUrl', () => {
  it('returns an empty string for null, undefined, or missing fields', () => {
    expect(normalizeImageUrl(null)).toBe('');
    expect(normalizeImageUrl(undefined)).toBe('');
    expect(normalizeImageUrl({})).toBe('');
    expect(normalizeImageUrl({ url: null })).toBe('');
  });

  it('extracts url from a string input', () => {
    expect(normalizeImageUrl('https://cdn.example.com/img.jpg')).toBe(
      'https://cdn.example.com/img.jpg'
    );
  });

  it('extracts url from an object input', () => {
    expect(normalizeImageUrl({ url: 'https://cdn.example.com/img.jpg' })).toBe(
      'https://cdn.example.com/img.jpg'
    );
  });

  it('trims whitespace around the url', () => {
    expect(normalizeImageUrl('  https://cdn.example.com/img.jpg  ')).toBe(
      'https://cdn.example.com/img.jpg'
    );
  });

  it('strips a single pair of surrounding quotes', () => {
    expect(normalizeImageUrl('"https://cdn.example.com/img.jpg"')).toBe(
      'https://cdn.example.com/img.jpg'
    );
  });

  it('strips repeated outer quotes produced by double-encoded JSON round-trips', () => {
    // Regression: previously the quote-stripping regex only removed a single
    // outer character, so `""https://..."` leaked one layer.
    expect(normalizeImageUrl('""https://cdn.example.com/img.jpg""')).toBe(
      'https://cdn.example.com/img.jpg'
    );
  });
});

describe('normalizeProductImages', () => {
  it('deduplicates and filters blanks', () => {
    expect(
      normalizeProductImages([
        'https://cdn.example.com/a.jpg',
        null,
        { url: 'https://cdn.example.com/a.jpg' },
        { url: '  https://cdn.example.com/b.jpg  ' },
        '',
      ])
    ).toEqual([
      'https://cdn.example.com/a.jpg',
      'https://cdn.example.com/b.jpg',
    ]);
  });

  it('returns an empty array for nullish input', () => {
    expect(normalizeProductImages(null)).toEqual([]);
    expect(normalizeProductImages(undefined)).toEqual([]);
  });
});

describe('normalizeProductColors', () => {
  it('accepts string and object entries and deduplicates', () => {
    expect(
      normalizeProductColors([
        'Black',
        { name: 'Red' },
        { name: '  Red  ' },
        null,
        { name: null },
        '',
      ])
    ).toEqual(['Black', 'Red']);
  });

  it('returns an empty array for nullish input', () => {
    expect(normalizeProductColors(null)).toEqual([]);
    expect(normalizeProductColors(undefined)).toEqual([]);
  });
});

describe('normalizeColorImages', () => {
  it('normalizes keys and urls, and drops empty buckets', () => {
    expect(
      normalizeColorImages({
        '  Black  ': ['https://cdn.example.com/black.jpg'],
        Red: [null, ''],
        Blue: ['"https://cdn.example.com/blue.jpg"'],
      })
    ).toEqual({
      Black: ['https://cdn.example.com/black.jpg'],
      Blue: ['https://cdn.example.com/blue.jpg'],
    });
  });

  it('returns undefined when input is nullish or yields no entries', () => {
    expect(normalizeColorImages(null)).toBeUndefined();
    expect(normalizeColorImages(undefined)).toBeUndefined();
    expect(normalizeColorImages({})).toBeUndefined();
    expect(normalizeColorImages({ Red: [null, ''] })).toBeUndefined();
  });

  it('merges image arrays when multiple keys normalize to the same color name', () => {
    // Regression: Object.fromEntries was used previously and would silently
    // drop earlier entries when two keys normalized to the same value (e.g.
    // `"Black"` and `Black` both normalize to `Black`). The reducer must
    // union both image arrays instead.
    expect(
      normalizeColorImages({
        '"Black"': ['https://cdn.example.com/black1.jpg'],
        Black: ['https://cdn.example.com/black2.jpg'],
      })
    ).toEqual({
      Black: [
        'https://cdn.example.com/black1.jpg',
        'https://cdn.example.com/black2.jpg',
      ],
    });
  });

  it('deduplicates images when merging duplicate normalized color keys', () => {
    expect(
      normalizeColorImages({
        '"Red"': [
          'https://cdn.example.com/red.jpg',
          'https://cdn.example.com/red2.jpg',
        ],
        Red: ['https://cdn.example.com/red.jpg'],
      })
    ).toEqual({
      Red: [
        'https://cdn.example.com/red.jpg',
        'https://cdn.example.com/red2.jpg',
      ],
    });
  });
});
