import { describe, expect, it } from 'vitest';
import {
  isConditionType,
  normalizeConditionType,
} from '@/components/storefront/ogabassey/pages/product-details-page/product-condition';

describe('isConditionType', () => {
  it('returns true for supported condition values', () => {
    expect(isConditionType('new')).toBe(true);
    expect(isConditionType('used')).toBe(true);
    expect(isConditionType('open_box')).toBe(true);
  });

  it('returns false for unsupported or empty values', () => {
    expect(isConditionType('open-box')).toBe(false);
    expect(isConditionType('refurbished')).toBe(false);
    expect(isConditionType('unknown')).toBe(false);
    expect(isConditionType(null)).toBe(false);
    expect(isConditionType(undefined)).toBe(false);
  });
});

describe('normalizeConditionType', () => {
  it('preserves canonical condition values', () => {
    expect(normalizeConditionType('new')).toBe('new');
    expect(normalizeConditionType('used')).toBe('used');
    expect(normalizeConditionType('open_box')).toBe('open_box');
    expect(normalizeConditionType('refurbished')).toBe('open_box');
    expect(normalizeConditionType('uk_used')).toBe('used');
  });

  it('normalizes hyphens, spaces, and casing for open_box', () => {
    expect(normalizeConditionType('open-box')).toBe('open_box');
    expect(normalizeConditionType(' Open Box ')).toBe('open_box');
    expect(normalizeConditionType('OPEN_BOX')).toBe('open_box');
  });

  it('defaults to new for invalid or missing values', () => {
    expect(normalizeConditionType('premium used')).toBe('new');
    expect(normalizeConditionType(null)).toBe('new');
    expect(normalizeConditionType(undefined)).toBe('new');
  });
});
