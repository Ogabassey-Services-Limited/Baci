process.env.TZ = 'UTC';

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
      new Date(0),
      new Date(0),
      new Date('2026-04-10T12:00:00.000Z')
    );

    expect(range.startDate.getUTCFullYear()).toBe(2025);
    expect(range.startDate.getUTCMonth()).toBe(0);
    expect(range.startDate.getUTCDate()).toBe(1);
    expect(range.startDate.getUTCHours()).toBe(0);
    expect(range.endDate.getUTCFullYear()).toBe(2025);
    expect(range.endDate.getUTCMonth()).toBe(11);
    expect(range.endDate.getUTCDate()).toBe(31);
    expect(range.endDate.getUTCHours()).toBe(23);
    expect(range.endDate.getUTCMinutes()).toBe(59);
    expect(range.endDate.getUTCSeconds()).toBe(59);
    expect(range.endDate.getUTCMilliseconds()).toBe(999);
  });

  it('resolves leap-year selected years to full-year boundaries', () => {
    const range = resolveAnalyticsDateRange(
      'this_year',
      2024,
      new Date(0),
      new Date(0),
      new Date('2026-04-10T12:00:00.000Z')
    );

    expect(range.startDate.toISOString()).toBe('2024-01-01T00:00:00.000Z');
    expect(range.endDate.toISOString()).toBe('2024-12-31T23:59:59.999Z');
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
    expect(range.startDate.getUTCDate()).toBe(8);
    expect(range.startDate.getUTCHours()).toBe(0);
    expect(range.endDate.getUTCFullYear()).toBe(2026);
    expect(range.endDate.getUTCMonth()).toBe(3);
    expect(range.endDate.getUTCDate()).toBe(10);
    expect(range.endDate.getUTCHours()).toBe(23);
    expect(range.endDate.getUTCMinutes()).toBe(59);
    expect(range.endDate.getUTCSeconds()).toBe(59);
    expect(range.endDate.getUTCMilliseconds()).toBe(999);
  });

  it('normalizes a same-day custom range to start and end of that day', () => {
    const range = resolveAnalyticsDateRange(
      'custom',
      2026,
      new Date('2024-02-29T14:30:00.000Z'),
      new Date('2024-02-29T14:30:00.000Z'),
      new Date('2026-04-10T12:00:00.000Z')
    );

    expect(range.startDate.toISOString()).toBe('2024-02-29T00:00:00.000Z');
    expect(range.endDate.toISOString()).toBe('2024-02-29T23:59:59.999Z');
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
    expect(range.startDate.getUTCDate()).toBe(8);
    expect(range.endDate.getUTCDate()).toBe(10);
  });

  it('keeps leap-day custom ranges intact when swapping and normalizing', () => {
    const range = resolveAnalyticsDateRange(
      'custom',
      2026,
      new Date('2024-03-01T10:10:00.000Z'),
      new Date('2024-02-29T18:45:00.000Z'),
      new Date('2026-04-10T12:00:00.000Z')
    );

    expect(range.startDate.toISOString()).toBe('2024-02-29T00:00:00.000Z');
    expect(range.endDate.toISOString()).toBe('2024-03-01T23:59:59.999Z');
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

  it('derives the previous range for a one-minute window', () => {
    const currentStart = new Date('2026-04-10T12:00:00.000Z');
    const currentEnd = new Date('2026-04-10T12:00:59.999Z');
    const previous = getPreviousAnalyticsDateRange({
      startDate: currentStart,
      endDate: currentEnd,
    });

    expect(previous.startDate.toISOString()).toBe('2026-04-10T11:59:00.000Z');
    expect(previous.endDate.toISOString()).toBe('2026-04-10T11:59:59.999Z');
  });

  it('derives the previous range for a multi-year window', () => {
    const currentStart = new Date('2022-01-01T00:00:00.000Z');
    const currentEnd = new Date('2025-12-31T23:59:59.999Z');
    const previous = getPreviousAnalyticsDateRange({
      startDate: currentStart,
      endDate: currentEnd,
    });

    const currentDuration = currentEnd.getTime() - currentStart.getTime();
    const previousDuration =
      previous.endDate.getTime() - previous.startDate.getTime();

    expect(previous.endDate.getTime()).toBeLessThan(currentStart.getTime());
    expect(previousDuration).toBe(currentDuration);
  });

  it('returns readable filter labels', () => {
    expect(getAnalyticsFilterLabel('today')).toBe('Today');
    expect(getAnalyticsFilterLabel('yesterday')).toBe('Yesterday');
    expect(getAnalyticsFilterLabel('this_week')).toBe('This week');
    expect(getAnalyticsFilterLabel('last_week')).toBe('Last week');
    expect(getAnalyticsFilterLabel('this_month')).toBe('This month');
    expect(getAnalyticsFilterLabel('last_month')).toBe('Last month');
    expect(getAnalyticsFilterLabel('this_year')).toBe('This year');
    expect(getAnalyticsFilterLabel('last_year')).toBe('Last year');
    expect(getAnalyticsFilterLabel('custom')).toBe('Custom range');
  });
});
