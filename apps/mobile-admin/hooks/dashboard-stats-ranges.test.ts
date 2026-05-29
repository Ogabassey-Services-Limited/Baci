import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDateRange, getPreviousPeriodDateRange } from './dashboard-stats-ranges';

describe('dashboard stat date ranges', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-29T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('builds current ranges for week and all time', () => {
    expect(getDateRange('week')).toEqual({
      end: '2026-05-29T12:00:00.000Z',
      start: '2026-05-22T12:00:00.000Z',
    });
    expect(getDateRange('all')).toEqual({
      end: '2026-05-29T12:00:00.000Z',
      start: null,
    });
  });

  it('builds previous period ranges when comparisons are available', () => {
    expect(getPreviousPeriodDateRange('today')).toEqual({
      end: '2026-05-28T23:00:00.000Z',
      start: '2026-05-27T23:00:00.000Z',
    });
    expect(getPreviousPeriodDateRange('all')).toBeNull();
  });
});
