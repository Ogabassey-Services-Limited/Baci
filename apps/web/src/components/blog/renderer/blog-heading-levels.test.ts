import { describe, expect, it } from 'vitest';
import {
  getBlogBodyHeadingLevel,
  normalizeSourceHeadingLevel,
} from './blog-heading-levels';

describe('normalizeSourceHeadingLevel', () => {
  it('clamps levels into the 1-6 range and truncates decimals', () => {
    expect(normalizeSourceHeadingLevel(0)).toBe(1);
    expect(normalizeSourceHeadingLevel(2.9)).toBe(2);
    expect(normalizeSourceHeadingLevel(9)).toBe(6);
  });

  it('defaults to 1 for non-numeric input', () => {
    expect(normalizeSourceHeadingLevel(undefined)).toBe(1);
    expect(normalizeSourceHeadingLevel('not-a-number')).toBe(1);
  });
});

describe('getBlogBodyHeadingLevel', () => {
  it('renders one level below the authored level within h2-h6', () => {
    expect(getBlogBodyHeadingLevel(1)).toBe(2);
    expect(getBlogBodyHeadingLevel(5)).toBe(6);
    expect(getBlogBodyHeadingLevel(6)).toBe(6);
  });
});
