import { describe, expect, it } from 'vitest';
import { formatMetricChange } from './format-metric-change';

describe('formatMetricChange', () => {
  it('limits positive deltas to one decimal place', () => {
    expect(formatMetricChange(36.07575103885193)).toBe('+36.1%');
  });

  it('drops trailing decimals for whole-number deltas', () => {
    expect(formatMetricChange(-80.02481389578163)).toBe('-80%');
  });

  it('preserves the sign for negative half-tenths when rounding', () => {
    expect(formatMetricChange(-0.05)).toBe('-0.1%');
    expect(formatMetricChange(-1.25)).toBe('-1.3%');
  });

  it('normalizes invalid and zero deltas', () => {
    expect(formatMetricChange(Number.NaN)).toBe('0%');
    expect(formatMetricChange(-0)).toBe('0%');
  });
});
