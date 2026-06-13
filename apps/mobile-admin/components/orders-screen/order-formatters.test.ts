import { describe, expect, it, vi } from 'vitest';
import { formatDateChipLabel } from './format-date-chip-label';
import { formatDateRangeLabel } from './format-date-range-label';
import { formatPrice } from './format-price';
import { formatTime } from './format-time';
import { getPresetDateRange } from './get-preset-date-range';

describe('order-formatters', () => {
  it('formats currency and invalid times safely', () => {
    expect(formatPrice(10_000, 'NGN')).toBe('₦10,000');
    expect(formatTime('not-a-date')).toBe('N/A');
  });

  it('formats date range labels', () => {
    const start = new Date('2026-06-01T00:00:00Z');
    const end = new Date('2026-06-12T00:00:00Z');

    expect(formatDateRangeLabel({ start, end })).toContain('2026');
    expect(formatDateChipLabel({ start, end })).toContain('Jun');
    expect(formatDateRangeLabel('Today')).toBe('Today');
    expect(formatDateChipLabel(null)).toBeNull();
  });

  it('builds preset ranges from fresh date instances', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-12T12:00:00Z'));

    const range = getPresetDateRange('Last 7 Days');

    expect(range.start).not.toBe(range.end);
    expect(range.start.getDate()).toBe(6);
    expect(range.end.getDate()).toBe(12);

    vi.useRealTimers();
  });
});
