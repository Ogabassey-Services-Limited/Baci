import { describe, expect, it } from 'vitest';
import {
  getAnalyticsFilterLabel,
  getPreviousAnalyticsDateRange,
  resolveAnalyticsDateRange,
} from './analytics-period';

describe('analytics-period', () => {
  it('resolves this year using the selected year', () => {
    const range = resolveAnalyticsDateRange(
      'this_year',
      2025,
      new Date('2025-01-01T00:00:00.000Z'),
      new Date('2025-01-31T00:00:00.000Z'),
      new Date('2026-04-10T12:00:00.000Z')
    );

    expect(range.startDate.getUTCFullYear()).toBe(2024);
    expect(range.startDate.getUTCMonth()).toBe(11);
    expect(range.startDate.getUTCDate()).toBe(31);
    expect(range.startDate.getUTCHours()).toBe(23);
    expect(range.endDate.getUTCFullYear()).toBe(2025);
    expect(range.endDate.getUTCMonth()).toBe(11);
    expect(range.endDate.getUTCDate()).toBe(31);
  });

  it('normalizes a custom range to day boundaries', () => {
    const range = resolveAnalyticsDateRange(
      'custom',
      2026,
      new Date('2026-04-08T10:10:00.000Z'),
      new Date('2026-04-10T18:45:00.000Z'),
      new Date('2026-04-10T12:00:00.000Z')
    );

    expect(range.startDate.getUTCFullYear()).toBe(2026);
    expect(range.startDate.getUTCMonth()).toBe(3);
    expect(range.startDate.getUTCDate()).toBe(7);
    expect(range.startDate.getUTCHours()).toBe(23);
    expect(range.endDate.getUTCFullYear()).toBe(2026);
    expect(range.endDate.getUTCMonth()).toBe(3);
    expect(range.endDate.getUTCDate()).toBe(10);
  });

  it('derives the previous range from the current range duration', () => {
    const previous = getPreviousAnalyticsDateRange({
      startDate: new Date('2026-04-08T00:00:00.000Z'),
      endDate: new Date('2026-04-10T23:59:59.999Z'),
    });

    const previousDuration =
      previous.endDate.getTime() - previous.startDate.getTime();
    const currentDuration =
      new Date('2026-04-10T23:59:59.999Z').getTime() -
      new Date('2026-04-08T00:00:00.000Z').getTime();

    expect(previous.endDate.getTime()).toBeLessThan(
      new Date('2026-04-08T00:00:00.000Z').getTime()
    );
    expect(previousDuration).toBe(currentDuration);
  });

  it('returns readable filter labels', () => {
    expect(getAnalyticsFilterLabel('this_month')).toBe('This month');
    expect(getAnalyticsFilterLabel('custom')).toBe('Custom range');
  });
});
