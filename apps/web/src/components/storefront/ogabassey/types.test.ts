import { describe, expect, it } from 'vitest';
import { normalizeProductCondition } from './types';

describe('normalizeProductCondition', () => {
  it('returns canonical values unchanged', () => {
    expect(normalizeProductCondition('new')).toBe('new');
    expect(normalizeProductCondition('used')).toBe('used');
    expect(normalizeProductCondition('open_box')).toBe('open_box');
    expect(normalizeProductCondition('refurbished')).toBe('refurbished');
  });

  it('trims, lowercases, and normalizes separators', () => {
    expect(normalizeProductCondition(' New ')).toBe('new');
    expect(normalizeProductCondition('open-box')).toBe('open_box');
    expect(normalizeProductCondition('open box')).toBe('open_box');
  });

  it('returns undefined for invalid inputs', () => {
    expect(normalizeProductCondition('collector-grade')).toBeUndefined();
    expect(normalizeProductCondition('')).toBeUndefined();
    expect(normalizeProductCondition(null)).toBeUndefined();
    expect(normalizeProductCondition(undefined)).toBeUndefined();
    expect(normalizeProductCondition(123 as never)).toBeUndefined();
  });
});
