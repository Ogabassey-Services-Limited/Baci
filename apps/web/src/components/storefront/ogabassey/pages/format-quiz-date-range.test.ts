import { describe, expect, it } from 'vitest';
import { formatQuizDateRange } from './format-quiz-date-range';

const baseEvent = {
  id: 'quiz-1',
  title: 'Launch quiz',
  description: null,
  status: 'active' as const,
  startsAt: null,
  endsAt: null,
  timeLimitSeconds: 60,
  maxAttempts: 1,
  rewardPoints: 5,
  questions: [],
};

describe('formatQuizDateRange', () => {
  it('formats missing, start-only, end-only, and ranged dates', () => {
    expect(formatQuizDateRange(baseEvent)).toBe('Time not set');
    expect(
      formatQuizDateRange({ ...baseEvent, startsAt: '2026-06-01T10:00:00Z' })
    ).toContain('Starts');
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
});
