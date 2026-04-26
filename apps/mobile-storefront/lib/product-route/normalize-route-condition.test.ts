import { describe, expect, it } from '@jest/globals';
import { normalizeRouteCondition } from './normalize-route-condition';

describe('normalizeRouteCondition', () => {
  it('normalizes legacy aliases to canonical values', () => {
    expect(normalizeRouteCondition('refurbished')).toBe('open_box');
    expect(normalizeRouteCondition('uk_used')).toBe('used');
  });

  it('returns null for empty or unknown values', () => {
    expect(normalizeRouteCondition(undefined)).toBeNull();
    expect(normalizeRouteCondition(null)).toBeNull();
    expect(normalizeRouteCondition('')).toBeNull();
    expect(normalizeRouteCondition('premium_used')).toBeNull();
  });

  it('returns canonical values unchanged', () => {
    expect(normalizeRouteCondition('new')).toBe('new');
    expect(normalizeRouteCondition('used')).toBe('used');
    expect(normalizeRouteCondition('open_box')).toBe('open_box');
  });
});
