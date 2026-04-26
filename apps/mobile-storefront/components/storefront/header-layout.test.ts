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

  it('returns the minimum spacing for values just below the threshold', () => {
    expect(getEliteHeaderTopPadding(SPACING.xs - 1)).toBe(SPACING.xs);
  });

  it('returns the inset for values just above the threshold', () => {
    expect(getEliteHeaderTopPadding(SPACING.xs + 1)).toBe(SPACING.xs + 1);
  });

  it('preserves decimal inset values above the threshold', () => {
    expect(getEliteHeaderTopPadding(44.5)).toBe(44.5);
  });

  it('preserves large inset values above the threshold', () => {
    expect(getEliteHeaderTopPadding(200)).toBe(200);
  });

  it('falls back to the minimum spacing for non-finite values', () => {
    expect(getEliteHeaderTopPadding(Number.NaN)).toBe(SPACING.xs);
    expect(getEliteHeaderTopPadding(Number.POSITIVE_INFINITY)).toBe(SPACING.xs);
  });
});
