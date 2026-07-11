import { describe, expect, it } from 'vitest';
import { formatRepairBookingDate } from './format-repair-booking-date';

describe('formatRepairBookingDate', () => {
  it('formats a valid ISO timestamp as a medium date + short time', () => {
    const formatted = formatRepairBookingDate('2026-07-01T09:30:00.000Z');

    expect(formatted).not.toBe('-');
    expect(formatted).toEqual(expect.stringContaining('2026'));
  });

  it('returns a placeholder for null input', () => {
    expect(formatRepairBookingDate(null)).toBe('-');
  });

  it('returns a placeholder for an empty string', () => {
    expect(formatRepairBookingDate('')).toBe('-');
  });

  it('returns a placeholder for an unparsable date string', () => {
    expect(formatRepairBookingDate('not-a-date')).toBe('-');
  });
});
