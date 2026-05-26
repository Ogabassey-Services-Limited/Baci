import { describe, expect, it } from 'vitest';
import {
  quizAttemptResponseSchema,
  quizEventsResponseSchema,
  quizResultResponseSchema,
} from '@/schemas/quiz';

const question = {
  id: 'question-1',
  index: 1,
  options: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
  ],
  prompt: 'Pick one',
  timeLimitSeconds: 30,
  total: 2,
};

describe('quiz client response schemas', () => {
  it('validates event list responses used by storefront quiz clients', () => {
    expect(
      quizEventsResponseSchema.parse({
        events: [
          {
            endsAt: '2026-05-26T12:00:00.000Z',
            id: 'event-1',
            prizeName: 'Store credit',
            questionCount: 2,
            startsAt: null,
            status: 'open',
            title: 'Daily Quiz',
          },
        ],
        pagination: {
          hasMore: false,
          limit: 50,
          nextOffset: null,
          offset: 0,
        },
      })
    ).toMatchObject({
      events: [{ id: 'event-1', status: 'open' }],
    });

    expect(() =>
      quizEventsResponseSchema.parse({
        events: [{ id: '', questionCount: 0, status: 'live' }],
      })
    ).toThrow();
  });

  it('validates attempt and result response contracts', () => {
    expect(
      quizAttemptResponseSchema.parse({
        attemptId: 'attempt-1',
        eventId: 'event-1',
        examPassPointsSpent: 1,
        question,
        remainingLoyaltyPoints: 4,
      })
    ).toMatchObject({
      attemptId: 'attempt-1',
      question: { id: 'question-1' },
    });

    expect(
      quizResultResponseSchema.parse({
        attemptId: 'attempt-1',
        correctAnswers: 1,
        prizeEligible: false,
        question,
        status: 'in_progress',
        totalQuestions: 2,
      })
    ).toMatchObject({
      question: { id: 'question-1' },
      status: 'in_progress',
    });

    expect(() =>
      quizResultResponseSchema.parse({
        attemptId: 'attempt-1',
        correctAnswers: 0,
        prizeEligible: false,
        status: 'in_progress',
        totalQuestions: 2,
      })
    ).toThrow();

    expect(() =>
      quizResultResponseSchema.parse({
        attemptId: 'attempt-1',
        correctAnswers: 3,
        prizeEligible: false,
        status: 'completed',
        totalQuestions: 2,
      })
    ).toThrow();
  });
});
