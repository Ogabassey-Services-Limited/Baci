import { describe, expect, it } from 'vitest';
import { stripOrderNumberPrefix } from './order-number';

describe('stripOrderNumberPrefix', () => {
  it('removes a leading hash from order numbers', () => {
    expect(stripOrderNumberPrefix('#ORD-001')).toBe('ORD-001');
  });

  it('returns an empty string for nullish values', () => {
    expect(stripOrderNumberPrefix(null)).toBe('');
    expect(stripOrderNumberPrefix(undefined)).toBe('');
  });
});
