import { describe, expect, it } from '@jest/globals';
import type { QuizEvent } from '@/services/quiz';
import {
  formatPointCount,
  formatTimeRange,
  getEventStartButtonText,
  getQuizErrorMessage,
} from './QuizScreen.utils';

describe('QuizScreen utils', () => {
  it('formats event time ranges and handles unset times', () => {
    const event: QuizEvent = {
      endsAt: '2026-05-20T11:00:00',
      id: 'event-1',
      prizeName: 'Prize',
      questionCount: 3,
      startsAt: '2026-05-20T10:00:00',
      status: 'open',
      title: 'Daily Prize Quiz',
    };

    const fallbackMessage = 'Schedule pending';

    expect(formatTimeRange(event, 'en-US', fallbackMessage)).toBe(
      '10:00 AM - 11:00 AM'
    );
    expect(
      formatTimeRange({ ...event, startsAt: null }, 'en-US', fallbackMessage)
    ).toBe(fallbackMessage);
    expect(
      formatTimeRange({ ...event, endsAt: null }, 'en-US', fallbackMessage)
    ).toBe(fallbackMessage);
    expect(
      formatTimeRange(
        { ...event, startsAt: 'not-a-date' },
        'en-US',
        fallbackMessage
      )
    ).toBe(fallbackMessage);
  });

  it('formats point counts with singular and plural forms', () => {
    expect(formatPointCount(-1)).toBe('-1 point');
    expect(formatPointCount(0)).toBe('0 points');
    expect(formatPointCount(1)).toBe('1 point');
    expect(formatPointCount(2, 'loyalty point')).toBe('2 loyalty points');
    expect(formatPointCount(2, 'entry', 'entries')).toBe('2 entries');
  });

  it('formats start button text for event status', () => {
    expect(getEventStartButtonText('open', false, 1)).toBe('Use 1 point to start');
    expect(getEventStartButtonText('open', false, 0)).toBe('Use 0 points to start');
    expect(getEventStartButtonText('open', false, 2)).toBe('Use 2 points to start');
    expect(getEventStartButtonText('open', false, -1)).toBe('Use -1 point to start');
    expect(getEventStartButtonText('open', true, 1)).toBe('Starting...');
    expect(getEventStartButtonText('scheduled', false, 1)).toBe('Scheduled');
    expect(getEventStartButtonText('closed', false, 1)).toBe('Closed');
  });

  it('normalizes unknown errors to user-facing messages', () => {
    expect(getQuizErrorMessage(new Error('Start failed'), 'Action failed')).toBe(
      'Start failed'
    );
    expect(getQuizErrorMessage('failed', 'Action failed')).toBe(
      'Action failed'
    );
  });
});
