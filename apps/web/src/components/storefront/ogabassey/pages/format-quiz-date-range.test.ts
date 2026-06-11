import type { QuizEventResponse } from '@/schemas/quiz';
import { describe, expect, it } from 'vitest';
import { formatQuizDateRange } from './format-quiz-date-range';

const baseEvent = {
  id: 'quiz-1',
  title: 'Launch quiz',
  prizeName: 'Launch prize',
  questionCount: 1,
  status: 'open',
  startsAt: null,
  endsAt: null,
} satisfies QuizEventResponse;

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
