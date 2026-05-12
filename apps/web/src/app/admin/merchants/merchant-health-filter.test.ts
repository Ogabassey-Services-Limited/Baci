import { describe, expect, it } from 'vitest';
import {
  HEALTH_FILTER_OPTIONS,
  isHealthFilter,
} from './merchant-health-filter';

describe('merchant health filter helpers', () => {
  it('accepts the supported admin merchant health filters', () => {
    expect(HEALTH_FILTER_OPTIONS).toEqual([
      'all',
      'healthy',
      'at_risk',
      'churned',
      'new',
    ]);

    for (const option of HEALTH_FILTER_OPTIONS) {
      expect(isHealthFilter(option)).toBe(true);
    }
  });

  it('rejects unsupported and malformed health filters', () => {
    expect(isHealthFilter('inactive')).toBe(false);
    expect(isHealthFilter('')).toBe(false);
    expect(isHealthFilter('foo')).toBe(false);
    expect(isHealthFilter(null as unknown as string)).toBe(false);
    expect(isHealthFilter(undefined as unknown as string)).toBe(false);
    expect(isHealthFilter(123 as unknown as string)).toBe(false);
  });
});
