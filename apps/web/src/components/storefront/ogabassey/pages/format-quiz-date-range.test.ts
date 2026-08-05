import { describe, expect, it } from 'vitest';
import { formatQuizDateRange } from './format-quiz-date-range';

const baseEvent = {
  endsAt: null,
  startsAt: null,
  timeZone: 'Africa/Lagos',
};

describe('formatQuizDateRange', () => {
  it('formats missing, start-only, end-only, and ranged dates', () => {
    expect(formatQuizDateRange(baseEvent)).toBe('Time not set');
    expect(
      formatQuizDateRange({ ...baseEvent, startsAt: '2026-06-01T10:00:00Z' })
    ).toContain('11:00');
    expect(
      formatQuizDateRange({ ...baseEvent, endsAt: '2026-06-02T10:00:00Z' })
    ).toContain('Ends');
    expect(
      formatQuizDateRange({
        ...baseEvent,
        startsAt: '2026-06-01T10:00:00Z',
        endsAt: '2026-06-02T10:00:00Z',
      })
    ).toContain(' - ');
  });

  it('uses the event time zone instead of the server runtime zone', () => {
    expect(
      formatQuizDateRange({
        ...baseEvent,
        startsAt: '2026-06-01T10:00:00Z',
        timeZone: 'UTC',
      })
    ).toContain('10:00');
  });

  it('falls back to the default time zone for an invalid identifier', () => {
    expect(
      formatQuizDateRange({
        ...baseEvent,
        startsAt: '2026-06-01T10:00:00Z',
        timeZone: 'Lagos',
      })
    ).toContain('11:00');
  });
});
