import { describe, expect, it } from '@jest/globals';
import { SPACING } from '@/constants/Colors';
import { getEliteHeaderTopPadding } from './header-layout';

describe('getEliteHeaderTopPadding', () => {
  it('uses the top inset when it is larger than the minimum spacing', () => {
    expect(getEliteHeaderTopPadding(44)).toBe(44);
  });

  it('falls back to the minimum elite header spacing when the inset is smaller', () => {
    expect(getEliteHeaderTopPadding(0)).toBe(SPACING.xs);
  });

  it('returns the minimum spacing when the inset equals the threshold', () => {
    expect(getEliteHeaderTopPadding(SPACING.xs)).toBe(SPACING.xs);
  });

  it('handles negative insets by returning the minimum spacing', () => {
    expect(getEliteHeaderTopPadding(-5)).toBe(SPACING.xs);
  });

  it('falls back to the minimum spacing for non-finite values', () => {
    expect(getEliteHeaderTopPadding(Number.NaN)).toBe(SPACING.xs);
    expect(getEliteHeaderTopPadding(Number.POSITIVE_INFINITY)).toBe(SPACING.xs);
    expect(getEliteHeaderTopPadding(Number.NEGATIVE_INFINITY)).toBe(SPACING.xs);
  });
});
