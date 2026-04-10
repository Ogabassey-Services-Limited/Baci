import { describe, expect, it } from 'vitest';
import {
  getAnalyticsFilterLabel,
  getPreviousAnalyticsDateRange,
  resolveAnalyticsDateRange,
} from '@/lib/analytics-period';

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
    expect(range.endDate.getUTCHours()).toBe(22);
    expect(range.endDate.getUTCMinutes()).toBe(59);
    expect(range.endDate.getUTCSeconds()).toBe(59);
    expect(range.endDate.getUTCMilliseconds()).toBe(999);
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
    expect(range.endDate.getUTCHours()).toBe(22);
    expect(range.endDate.getUTCMinutes()).toBe(59);
    expect(range.endDate.getUTCSeconds()).toBe(59);
    expect(range.endDate.getUTCMilliseconds()).toBe(999);
  });

  it('swaps inverted custom date ranges before normalizing', () => {
    const range = resolveAnalyticsDateRange(
      'custom',
      2026,
      new Date('2026-04-10T10:10:00.000Z'),
      new Date('2026-04-08T18:45:00.000Z'),
      new Date('2026-04-10T12:00:00.000Z')
    );

    expect(range.startDate.getTime()).toBeLessThan(range.endDate.getTime());
    expect(range.startDate.getUTCDate()).toBe(7);
    expect(range.endDate.getUTCDate()).toBe(10);
  });

  it('derives the previous range from the current range duration', () => {
    const currentStart = new Date('2026-04-08T00:00:00.000Z');
    const currentEnd = new Date('2026-04-10T23:59:59.999Z');
    const previous = getPreviousAnalyticsDateRange({
      startDate: currentStart,
      endDate: currentEnd,
    });

    const previousDuration =
      previous.endDate.getTime() - previous.startDate.getTime();
    const currentDuration = currentEnd.getTime() - currentStart.getTime();

    expect(previous.endDate.getTime()).toBeLessThan(currentStart.getTime());
    expect(previousDuration).toBe(currentDuration);
  });

  it('returns readable filter labels', () => {
    expect(getAnalyticsFilterLabel('this_month')).toBe('This month');
    expect(getAnalyticsFilterLabel('custom')).toBe('Custom range');
  });
});
