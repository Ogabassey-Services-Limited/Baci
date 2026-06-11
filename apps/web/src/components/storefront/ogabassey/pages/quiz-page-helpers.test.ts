import { describe, expect, it } from 'vitest';
import type { QuizEventResponse } from '@/schemas/quiz';
import {
  formatQuizDateRange,
  formatQuizPointCount,
  getQuizErrorMessage,
  getQuizStartButtonText,
} from './quiz-page-helpers';

const baseEvent = {
  id: 'event-1',
  title: 'Super Quiz',
  prizeName: 'Gift voucher',
  status: 'open',
  questionCount: 5,
  startsAt: null,
  endsAt: null,
} satisfies QuizEventResponse;

describe('quiz-page-helpers', () => {
  it('formats user-facing fallback errors', () => {
    expect(getQuizErrorMessage(new Error('Quiz unavailable'))).toBe(
      'Quiz unavailable'
    );
    expect(getQuizErrorMessage(null)).toBe(
      'Quiz action failed. Please try again.'
    );
  });

  it('formats loyalty point counts with singular and plural labels', () => {
    expect(formatQuizPointCount(1)).toBe('1 loyalty point');
    expect(formatQuizPointCount(3)).toBe('3 loyalty points');
  });

  it('formats quiz event date states', () => {
    expect(formatQuizDateRange(baseEvent)).toBe('Time not set');
    expect(
      formatQuizDateRange({
        ...baseEvent,
        startsAt: '2026-06-11T10:00:00.000Z',
      })
    ).toContain('Starts');
    expect(
      formatQuizDateRange({
        ...baseEvent,
        endsAt: '2026-06-11T11:00:00.000Z',
      })
    ).toContain('Ends');
    expect(
      formatQuizDateRange({
        ...baseEvent,
        startsAt: '2026-06-11T10:00:00.000Z',
        endsAt: '2026-06-11T11:00:00.000Z',
      })
    ).toContain(' - ');
  });

  it('returns start button labels from event status', () => {
    expect(getQuizStartButtonText(baseEvent, false)).toBe('Start exam');
    expect(getQuizStartButtonText(baseEvent, true)).toBe('Starting...');
    expect(
      getQuizStartButtonText({ ...baseEvent, status: 'scheduled' }, false)
    ).toBe('Coming soon');
    expect(getQuizStartButtonText({ ...baseEvent, status: 'closed' }, false))
      .toBe('Closed');
  });
});
