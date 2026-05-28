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
            prizeName: 'iPhone 15 Pro Max',
            prizeProduct: {
              id: '55555555-5555-4555-8555-555555555555',
              imageUrl: 'https://cdn.example.com/iphone.png',
              name: 'iPhone 15 Pro Max',
              variantId: null,
            },
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

    expect(
      quizResultResponseSchema.parse({
        attemptId: 'attempt-1',
        correctAnswers: 2,
        prizeClaim: {
          awardId: '44444444-4444-4444-8444-444444444444',
          cartPath:
            '/ogabassey/cart?item_id=55555555-5555-4555-8555-555555555555&quiz_award_id=44444444-4444-4444-8444-444444444444&quiz_voucher_token=signed-token',
          condition: null,
          productId: '55555555-5555-4555-8555-555555555555',
          variantId: null,
          voucherToken: 'signed-token',
        },
        prizeEligible: true,
        status: 'completed',
        totalQuestions: 2,
      })
    ).toMatchObject({
      prizeClaim: {
        productId: '55555555-5555-4555-8555-555555555555',
      },
      status: 'completed',
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
