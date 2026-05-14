import { describe, expect, it } from 'vitest';
import { getTrustCoverageSeverity } from './get-trust-coverage-severity';

describe('getTrustCoverageSeverity', () => {
  it('maps empty, missing, partial, and complete coverage to trust severity', () => {
    expect(getTrustCoverageSeverity(0, 0)).toBe('warn');
    expect(getTrustCoverageSeverity(0, 2)).toBe('fail');
    expect(getTrustCoverageSeverity(1, 2)).toBe('warn');
    expect(getTrustCoverageSeverity(2, 2)).toBe('pass');
  });
});
