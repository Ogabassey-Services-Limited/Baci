import { describe, expect, it } from 'vitest';
import { maximumBaselineAgeDays } from './ogabassey-current-origin-baseline-window';

describe('maximumBaselineAgeDays', () => {
  it('uses and caps production freshness at seven days', () => {
    expect(maximumBaselineAgeDays()).toBe(7);
    expect(maximumBaselineAgeDays(3)).toBe(3);
    expect(maximumBaselineAgeDays(40)).toBe(7);
  });

  it('preserves invalid values for fail-closed validation by the gate', () => {
    expect(maximumBaselineAgeDays(Number.NaN)).toBeNaN();
    expect(maximumBaselineAgeDays(Number.POSITIVE_INFINITY)).toBe(
      Number.POSITIVE_INFINITY
    );
  });
});
