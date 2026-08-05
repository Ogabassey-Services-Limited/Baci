import { describe, expect, it } from 'vitest';
import {
  quizAttemptResponseSchema,
  quizEventResponseSchema,
  quizEventsResponseSchema,
  quizResultResponseSchema,
  quizV2EventSchema,
  quizV2ResultResponseSchema,
} from '@/schemas/quiz';

const question = {
  deadlineAt: '2026-07-08T12:00:30.000Z',
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

  it('requires complete v2 timing and rules metadata but normalizes legacy events', () => {
    const v2Event = {
      contractVersion: 2,
      endsAt: '2026-08-04T12:05:00.000Z',
      id: 'event-v2',
      liveWindowSeconds: 300,
      maxAttempts: 1,
      maximumPlaySeconds: 200,
      mode: 'live' as const,
      prizeName: 'MacBook USB',
      prizeProduct: {
        condition: 'used' as const,
        id: '55555555-5555-4555-8555-555555555555',
        imageUrl: 'https://cdn.example.com/macbook.png',
        name: 'MacBook USB',
        variantId: null,
      },
      questionCount: 20,
      resultsPublishedAt: null,
      rulesVersion: 'test-v1',
      startsAt: '2026-08-04T12:00:00.000Z',
      status: 'scheduled' as const,
      timePerQuestionSeconds: 10,
      timeZone: 'Africa/Lagos',
      title: 'Daily devices quiz',
    };

    expect(quizV2EventSchema.parse(v2Event)).toEqual(v2Event);
    expect(
      quizEventResponseSchema.parse({
        endsAt: '2026-08-04T12:05:00.000Z',
        id: 'legacy-event',
        prizeName: 'Legacy prize',
        questionCount: 2,
        startsAt: '2026-08-04T12:04:00.000Z',
        status: 'scheduled',
        title: 'Legacy quiz',
      })
    ).toMatchObject({
      contractVersion: 1,
      liveWindowSeconds: 60,
      maximumPlaySeconds: 60,
      timeZone: 'Africa/Lagos',
    });
    expect(
      quizEventsResponseSchema.parse({
        contractVersion: 2,
        entryMode: 'free-v1',
        events: [v2Event],
        serverNow: '2026-08-04T12:01:00.000Z',
      })
    ).toMatchObject({ events: [v2Event] });
    expect(
      quizV2EventSchema.safeParse({ ...v2Event, mode: 'live', maxAttempts: 2 })
        .success
    ).toBe(false);
    expect(
      quizEventsResponseSchema.safeParse({
        contractVersion: 2,
        entryMode: 'free-v1',
        events: [
          {
            ...v2Event,
            complianceVerified: true,
          },
        ],
        serverNow: '2026-08-04T12:01:00.000Z',
      }).success
    ).toBe(false);
    expect(
      quizEventResponseSchema.safeParse({
        ...v2Event,
        complianceVerified: true,
      }).success
    ).toBe(false);
    expect(
      quizEventResponseSchema.safeParse({
        ...v2Event,
        contractVersion: undefined,
      }).success
    ).toBe(false);
    expect(
      quizEventResponseSchema.safeParse({
        endsAt: '2026-08-04T12:03:00.000Z',
        id: 'inverted-legacy-event',
        prizeName: 'Legacy prize',
        questionCount: 2,
        startsAt: '2026-08-04T12:04:00.000Z',
        status: 'scheduled',
        title: 'Legacy quiz',
      }).success
    ).toBe(false);
  });

  it('uses a separate owner-result contract for pending and published v2 results', () => {
    expect(
      quizV2ResultResponseSchema.parse({
        attemptId: 'attempt-v2',
        availability: 'pending',
        availableAt: null,
      })
    ).not.toHaveProperty('score');
    expect(
      quizV2ResultResponseSchema.parse({
        attemptId: 'attempt-v2',
        availability: 'final',
        availableAt: '2026-08-04T12:05:00.000Z',
        rank: 1,
        score: 20,
        totalQuestions: 20,
      })
    ).toMatchObject({ availability: 'final', rank: 1 });
    expect(
      quizV2ResultResponseSchema.safeParse({
        attemptId: 'attempt-v2',
        availability: 'pending',
        availableAt: null,
        claim: { token: 'not-allowed' },
      }).success
    ).toBe(false);
    expect(
      quizV2ResultResponseSchema.safeParse({
        attemptId: 'attempt-v2',
        availability: 'final',
        availableAt: '2026-08-04T12:05:00.000Z',
      }).success
    ).toBe(false);
  });
});
