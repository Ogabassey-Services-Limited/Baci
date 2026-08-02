import { describe, expect, it } from 'vitest';
import {
  parseStrictUtcBoundary,
  STRICT_UTC_BOUNDARY_PATTERN,
  UTC_DAY_MILLISECONDS,
} from './utc-boundary';

describe('strict UTC boundary helpers', () => {
  it('accepts canonical midnight boundaries and exposes the day length', () => {
    expect(STRICT_UTC_BOUNDARY_PATTERN.test('2026-08-01T00:00:00.000Z')).toBe(
      true
    );
    expect(parseStrictUtcBoundary('2026-08-01T00:00:00.000Z')).toEqual(
      new Date('2026-08-01T00:00:00.000Z')
    );
    expect(UTC_DAY_MILLISECONDS).toBe(86_400_000);
  });

  it('rejects normalized calendar dates and non-midnight values', () => {
    expect(parseStrictUtcBoundary('2026-02-30T00:00:00.000Z')).toBeNull();
    expect(parseStrictUtcBoundary('2026-08-01T00:00:00.001Z')).toBeNull();
  });
});
