import { describe, expect, it } from 'vitest';
import { normalizeAnalyticsId } from './analytics-id';

describe('normalizeAnalyticsId', () => {
  it('trims string analytics identifiers', () => {
    expect(normalizeAnalyticsId(' G-STORE ')).toBe('G-STORE');
  });

  it('coerces numeric legacy identifiers to strings', () => {
    expect(normalizeAnalyticsId(12345)).toBe('12345');
  });

  it('drops blank, nullish, and unsupported analytics identifiers', () => {
    expect(normalizeAnalyticsId('   ')).toBeNull();
    expect(normalizeAnalyticsId(null)).toBeNull();
    expect(normalizeAnalyticsId(undefined)).toBeNull();
    expect(normalizeAnalyticsId(false)).toBeNull();
    expect(normalizeAnalyticsId({ id: 'G-STORE' })).toBeNull();
  });
});
