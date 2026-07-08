import { describe, expect, it } from 'vitest';
import {
  buildDeviceSlug,
  nextAvailableSlug,
  slugifyRepair,
} from './catalog-slug';

describe('slugifyRepair', () => {
  it('lowercases and hyphenates', () => {
    expect(slugifyRepair('Screen Replacement')).toBe('screen-replacement');
  });

  it('collapses non-alphanumeric runs and trims hyphens', () => {
    expect(slugifyRepair('  iPhone 12 (Pro)!! ')).toBe('iphone-12-pro');
  });

  it('falls back to "item" for empty input', () => {
    expect(slugifyRepair('   ')).toBe('item');
    expect(slugifyRepair('!!!')).toBe('item');
  });
});

describe('buildDeviceSlug', () => {
  it('combines brand and model', () => {
    expect(buildDeviceSlug('Apple', 'iPhone 12')).toBe('apple-iphone-12');
  });
});

describe('nextAvailableSlug', () => {
  it('returns the base when free', () => {
    expect(nextAvailableSlug('apple-iphone-12', new Set())).toBe(
      'apple-iphone-12'
    );
  });

  it('appends the next numeric suffix on collision', () => {
    const taken = new Set(['apple-iphone-12', 'apple-iphone-12-2']);
    expect(nextAvailableSlug('apple-iphone-12', taken)).toBe(
      'apple-iphone-12-3'
    );
  });

  it('does not mutate the provided set', () => {
    const taken = new Set(['apple-iphone-12']);
    nextAvailableSlug('apple-iphone-12', taken);
    expect(taken.has('apple-iphone-12-2')).toBe(false);
  });
});
