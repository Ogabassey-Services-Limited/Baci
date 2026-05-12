import { describe, expect, it } from 'vitest';
import { getJoinedRecord } from './useAnalyticsDetail.types';

describe('getJoinedRecord', () => {
  it('returns the first element from an array', () => {
    expect(getJoinedRecord([{ id: '1' }, { id: '2' }])).toEqual({ id: '1' });
  });

  it('returns null for an empty array', () => {
    expect(getJoinedRecord([])).toBeNull();
  });

  it('returns the value when it is not an array', () => {
    expect(getJoinedRecord({ id: '1' })).toEqual({ id: '1' });
  });

  it('returns null for null or undefined', () => {
    expect(getJoinedRecord(null)).toBeNull();
    expect(getJoinedRecord(undefined)).toBeNull();
  });
});
