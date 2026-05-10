import { describe, expect, it } from 'vitest';
import { getFirstSearchParam } from '@/lib/search-params';

describe('getFirstSearchParam', () => {
  it('returns a scalar search param unchanged', () => {
    expect(getFirstSearchParam('value')).toBe('value');
  });

  it('returns the first array search param value', () => {
    expect(getFirstSearchParam(['first', 'second'])).toBe('first');
  });

  it('returns undefined when the search param is absent', () => {
    expect(getFirstSearchParam(undefined)).toBeUndefined();
  });

  it('returns undefined when an array search param is empty', () => {
    expect(getFirstSearchParam([])).toBeUndefined();
  });

  it('returns undefined when the first array value is not a string', () => {
    expect(getFirstSearchParam([123, 'second'])).toBeUndefined();
  });

  it('preserves an empty scalar search param', () => {
    expect(getFirstSearchParam('')).toBe('');
  });

  it('returns the only element from a single-element array', () => {
    expect(getFirstSearchParam(['single'])).toBe('single');
  });

  it('ignores non-string search param values', () => {
    expect(getFirstSearchParam({ nested: true })).toBeUndefined();
    expect(getFirstSearchParam(null)).toBeUndefined();
    expect(getFirstSearchParam(123)).toBeUndefined();
  });
});
