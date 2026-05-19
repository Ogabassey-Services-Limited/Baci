import { describe, expect, it } from 'vitest';
import {
  claimQuizCashAwardSchema,
  claimQuizGrandPrizeSchema,
  finalizeQuizAwardsSchema,
  quizAttemptParamsSchema,
  quizEventRowSchema,
  quizEventsQuerySchema,
  startQuizAttemptSchema,
  submitQuizAnswerSchema,
} from '@/schemas/quiz';

const EVENT_ID = '11111111-1111-1111-1111-111111111111';
const ATTEMPT_ID = '22222222-2222-2222-2222-222222222222';
const QUESTION_ID = '33333333-3333-3333-3333-333333333333';
const AWARD_ID = '44444444-4444-4444-4444-444444444444';
const MERCHANT_ID = '55555555-5555-5555-5555-555555555555';

describe('quiz route schemas', () => {
  it('validates start attempt payloads', () => {
    expect(
      startQuizAttemptSchema.parse({
        eventId: EVENT_ID,
        integrityTier: 'basic',
      })
    ).toEqual({
      eventId: EVENT_ID,
      integrityTier: 'basic',
    });

    expect(
      startQuizAttemptSchema.parse({
        eventId: EVENT_ID,
        integrityTier: 'device',
      })
    ).toEqual({
      eventId: EVENT_ID,
      integrityTier: 'device',
    });

    expect(
      startQuizAttemptSchema.parse({
        eventId: EVENT_ID,
        integrityTier: 'strong',
      })
    ).toEqual({
      eventId: EVENT_ID,
      integrityTier: 'strong',
    });

    expect(() =>
      startQuizAttemptSchema.parse({ eventId: 'bad', integrityTier: 'basic' })
    ).toThrow();
    expect(() =>
      startQuizAttemptSchema.parse({ eventId: EVENT_ID, integrityTier: 'gold' })
    ).toThrow();
    expect(() =>
      startQuizAttemptSchema.parse({ integrityTier: 'basic' })
    ).toThrow();
    expect(() => startQuizAttemptSchema.parse({ eventId: EVENT_ID })).toThrow();
  });

  it('validates submit answer payloads without accepting unknown tiers', () => {
    expect(
      submitQuizAnswerSchema.parse({
        answer: 'A',
        clientAnsweredAt: '2026-05-16T10:00:00.000Z',
        integrityTier: 'strong',
        questionId: QUESTION_ID,
      })
    ).toEqual({
      answer: 'A',
      clientAnsweredAt: '2026-05-16T10:00:00.000Z',
      integrityTier: 'strong',
      questionId: QUESTION_ID,
    });

    expect(
      submitQuizAnswerSchema.parse({
        answer: 'B',
        integrityTier: 'basic',
        questionId: QUESTION_ID,
      })
    ).toEqual({
      answer: 'B',
      integrityTier: 'basic',
      questionId: QUESTION_ID,
    });

    expect(
      submitQuizAnswerSchema.parse({
        answer: 'C'.repeat(500),
        integrityTier: 'device',
        questionId: QUESTION_ID,
      })
    ).toEqual({
      answer: 'C'.repeat(500),
      integrityTier: 'device',
      questionId: QUESTION_ID,
    });

    expect(() =>
      submitQuizAnswerSchema.parse({
        answer: '',
        integrityTier: 'basic',
        questionId: QUESTION_ID,
      })
    ).toThrow();
    expect(() =>
      submitQuizAnswerSchema.parse({
        answer: 'A',
        integrityTier: 'unknown',
        questionId: QUESTION_ID,
      })
    ).toThrow();
    expect(() =>
      submitQuizAnswerSchema.parse({
        answer: 'A',
        clientAnsweredAt: '2026-05-16 10:00:00',
        integrityTier: 'basic',
        questionId: QUESTION_ID,
      })
    ).toThrow();
    expect(() =>
      submitQuizAnswerSchema.parse({
        answer: 'A'.repeat(501),
        integrityTier: 'basic',
        questionId: QUESTION_ID,
      })
    ).toThrow();
    expect(() =>
      submitQuizAnswerSchema.parse({
        answer: 'A',
        integrityTier: 'basic',
      })
    ).toThrow();
  });

  it('validates award and prize claim payloads', () => {
    expect(finalizeQuizAwardsSchema.parse({ eventId: EVENT_ID })).toEqual({
      eventId: EVENT_ID,
    });
    expect(claimQuizGrandPrizeSchema.parse({ eventId: EVENT_ID })).toEqual({
      eventId: EVENT_ID,
    });
    expect(claimQuizCashAwardSchema.parse({ awardId: AWARD_ID })).toEqual({
      awardId: AWARD_ID,
    });

    expect(() =>
      finalizeQuizAwardsSchema.parse({ eventId: ATTEMPT_ID.slice(0, 8) })
    ).toThrow();
    expect(() =>
      claimQuizGrandPrizeSchema.parse({ eventId: 'not-a-uuid' })
    ).toThrow();
    expect(() =>
      claimQuizCashAwardSchema.parse({ awardId: 'not-a-uuid' })
    ).toThrow();
  });

  it('validates bounded event list pagination', () => {
    expect(
      quizEventsQuerySchema.parse({
        limit: '25',
        merchantId: MERCHANT_ID,
        offset: '10',
      })
    ).toEqual({
      limit: 25,
      merchantId: MERCHANT_ID,
      merchantSlug: undefined,
      offset: 10,
    });
    expect(quizEventsQuerySchema.parse({ merchantId: MERCHANT_ID })).toEqual({
      limit: 20,
      merchantId: MERCHANT_ID,
      merchantSlug: undefined,
      offset: 0,
    });
    expect(
      quizEventsQuerySchema.parse({ limit: '1', merchantSlug: ' ogabassey ' })
    ).toEqual({
      limit: 1,
      merchantId: undefined,
      merchantSlug: 'ogabassey',
      offset: 0,
    });
    expect(
      quizEventsQuerySchema.parse({ limit: '50', merchantId: MERCHANT_ID })
    ).toEqual({
      limit: 50,
      merchantId: MERCHANT_ID,
      merchantSlug: undefined,
      offset: 0,
    });

    expect(() => quizEventsQuerySchema.parse({ limit: '500' })).toThrow();
    expect(() => quizEventsQuerySchema.parse({ limit: '0' })).toThrow();
    expect(() => quizEventsQuerySchema.parse({ offset: '-1' })).toThrow();
    expect(() => quizEventsQuerySchema.parse({})).toThrow();
    expect(() =>
      quizEventsQuerySchema.parse({ merchantSlug: '   ' })
    ).toThrow();
    expect(() => quizEventsQuerySchema.parse({ merchantId: 'bad' })).toThrow();
    expect(() =>
      quizEventsQuerySchema.parse({
        merchantId: MERCHANT_ID,
        merchantSlug: 'ogabassey',
      })
    ).toThrow();
  });

  it('validates quiz event database rows at runtime', () => {
    expect(
      quizEventRowSchema.parse({
        ends_at: null,
        id: EVENT_ID,
        quiz_question_slots: [
          {
            active: true,
            id: QUESTION_ID,
            quiz_question_variants: [
              {
                active: true,
                id: '44444444-4444-4444-4444-444444444444',
              },
            ],
          },
        ],
        settings: { prize_name: 'Store credit', time_limit_seconds: '30' },
        starts_at: '2026-05-16T10:00:00.000Z',
        status: 'active',
        title: 'Daily quiz',
      })
    ).toEqual({
      ends_at: null,
      id: EVENT_ID,
      quiz_question_slots: [
        {
          active: true,
          id: QUESTION_ID,
          quiz_question_variants: [
            {
              active: true,
              id: '44444444-4444-4444-4444-444444444444',
            },
          ],
        },
      ],
      settings: { prize_name: 'Store credit', time_limit_seconds: 30 },
      starts_at: '2026-05-16T10:00:00.000Z',
      status: 'active',
      title: 'Daily quiz',
    });

    expect(
      quizEventRowSchema.parse({
        ends_at: null,
        id: EVENT_ID,
        settings: { prize_name: 'Store credit', unexpected: true },
        starts_at: '2026-05-16T10:00:00.000Z',
        status: 'active',
        title: 'Daily quiz',
      })
    ).toMatchObject({
      settings: { prize_name: 'Store credit' },
    });
    expect(() =>
      quizEventRowSchema.parse({
        id: EVENT_ID,
        settings: null,
        status: 'active',
        title: 'Daily quiz',
      })
    ).toThrow();
    expect(() =>
      quizEventRowSchema.parse({
        ends_at: '2026-05-16 11:00:00',
        id: EVENT_ID,
        settings: { prize_name: 'Store credit' },
        starts_at: '2026-05-16 10:00:00',
        status: 'active',
        title: 'Daily quiz',
      })
    ).toThrow();
    expect(() =>
      quizEventRowSchema.parse({
        ends_at: null,
        id: 'not-a-uuid',
        settings: { prize_name: 'Store credit' },
        starts_at: '2026-05-16T10:00:00.000Z',
        status: 'active',
        title: 'Daily quiz',
      })
    ).toThrow();
    expect(() =>
      quizEventRowSchema.parse({
        ends_at: null,
        id: EVENT_ID,
        quiz_question_slots: [
          {
            active: true,
            id: 'not-a-uuid',
            quiz_question_variants: [
              {
                active: true,
                id: '44444444-4444-4444-4444-444444444444',
              },
            ],
          },
        ],
        settings: { prize_name: 'Store credit' },
        starts_at: '2026-05-16T10:00:00.000Z',
        status: 'active',
        title: 'Daily quiz',
      })
    ).toThrow();
  });

  it('validates attempt route params centrally', () => {
    expect(quizAttemptParamsSchema.parse({ attemptId: ATTEMPT_ID })).toEqual({
      attemptId: ATTEMPT_ID,
    });
    expect(() =>
      quizAttemptParamsSchema.parse({ attemptId: 'not-a-uuid' })
    ).toThrow();
    expect(() => quizAttemptParamsSchema.parse({})).toThrow();
  });
});
