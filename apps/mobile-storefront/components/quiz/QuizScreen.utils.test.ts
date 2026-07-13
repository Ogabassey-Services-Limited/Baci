import { describe, expect, it } from '@jest/globals';
import type { QuizEvent } from '@/services/quiz';
import {
  formatTimeRange,
  getEventStartButtonText,
  getQuizErrorMessage,
  shouldShowEventList,
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

  it('advertises free entry on the start button for an open event', () => {
    expect(getEventStartButtonText('open', false)).toBe('Start free exam');
  });

  it('formats start button text for the other event states', () => {
    expect(getEventStartButtonText('open', true)).toBe('Starting...');
    expect(getEventStartButtonText('scheduled', false)).toBe('Scheduled');
    expect(getEventStartButtonText('closed', false)).toBe('Closed');
  });

  it('normalizes unknown errors to user-facing messages', () => {
    expect(
      getQuizErrorMessage(new Error('Start failed'), 'Action failed')
    ).toBe('Start failed');
    expect(getQuizErrorMessage('failed', 'Action failed')).toBe(
      'Action failed'
    );
  });

  it('keeps the event list visible in list and result states only', () => {
    expect(shouldShowEventList('ready')).toBe(true);
    expect(shouldShowEventList('starting')).toBe(true);
    expect(shouldShowEventList('result')).toBe(true);
    expect(shouldShowEventList('question')).toBe(false);
    expect(shouldShowEventList('loading')).toBe(false);
  });
});
