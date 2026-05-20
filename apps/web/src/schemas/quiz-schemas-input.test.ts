import { describe, expect, it } from 'vitest';
import {
  claimQuizCashAwardSchema,
  claimQuizGrandPrizeSchema,
  finalizeQuizAwardsSchema,
  startQuizAttemptSchema,
  submitQuizAnswerSchema,
} from '@/schemas/quiz';

const EVENT_ID = '11111111-1111-1111-1111-111111111111';
const ATTEMPT_ID = '22222222-2222-2222-2222-222222222222';
const QUESTION_ID = '33333333-3333-3333-3333-333333333333';
const AWARD_ID = '44444444-4444-4444-4444-444444444444';

describe('quiz route input schemas', () => {
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
});
