import { QUIZ_FREE_ENTRY_MODE } from '@baci/shared/constants';
import { describe, expect, it } from 'vitest';
import {
  claimQuizCashAwardSchema,
  claimQuizGrandPrizeSchema,
  finalizeQuizAwardsSchema,
  merchantQuizActivationRequestSchema,
  merchantQuizGenerationRequestSchema,
  startQuizAttemptSchema,
  submitQuizAnswerSchema,
} from '@/schemas/quiz';

const EVENT_ID = '11111111-1111-4111-8111-111111111111';
const ATTEMPT_ID = '22222222-2222-4222-8222-222222222222';
const QUESTION_ID = '33333333-3333-4333-8333-333333333333';
const AWARD_ID = '44444444-4444-4444-8444-444444444444';
const PRODUCT_ID = '55555555-5555-4555-8555-555555555555';
const VARIANT_ID = '66666666-6666-4666-8666-666666666666';

describe('quiz route input schemas', () => {
  it('validates start attempt payloads', () => {
    expect(
      startQuizAttemptSchema.parse({
        entryMode: QUIZ_FREE_ENTRY_MODE,
        eventId: EVENT_ID,
        integrityTier: 'basic',
      })
    ).toEqual({
      entryMode: QUIZ_FREE_ENTRY_MODE,
      eventId: EVENT_ID,
      integrityTier: 'basic',
    });

    expect(
      startQuizAttemptSchema.parse({
        entryMode: QUIZ_FREE_ENTRY_MODE,
        eventId: EVENT_ID,
        integrityTier: 'device',
      })
    ).toEqual({
      entryMode: QUIZ_FREE_ENTRY_MODE,
      eventId: EVENT_ID,
      integrityTier: 'device',
    });

    expect(
      startQuizAttemptSchema.parse({
        entryMode: QUIZ_FREE_ENTRY_MODE,
        eventId: EVENT_ID,
        integrityTier: 'strong',
      })
    ).toEqual({
      entryMode: QUIZ_FREE_ENTRY_MODE,
      eventId: EVENT_ID,
      integrityTier: 'strong',
    });

    expect(() =>
      startQuizAttemptSchema.parse({
        entryMode: QUIZ_FREE_ENTRY_MODE,
        eventId: 'bad',
        integrityTier: 'basic',
      })
    ).toThrow();
    expect(() =>
      startQuizAttemptSchema.parse({
        entryMode: QUIZ_FREE_ENTRY_MODE,
        eventId: EVENT_ID,
        integrityTier: 'gold',
      })
    ).toThrow();
    expect(() =>
      startQuizAttemptSchema.parse({
        entryMode: QUIZ_FREE_ENTRY_MODE,
        integrityTier: 'basic',
      })
    ).toThrow();
    expect(() =>
      startQuizAttemptSchema.parse({
        entryMode: QUIZ_FREE_ENTRY_MODE,
        eventId: EVENT_ID,
      })
    ).toThrow();
    expect(() =>
      startQuizAttemptSchema.parse({
        eventId: EVENT_ID,
        integrityTier: 'basic',
      })
    ).toThrow();
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

  it('validates merchant quiz generation payloads', () => {
    const basePayload = {
      prizeProductId: PRODUCT_ID,
      questionCountPerTopic: 1,
      timeLimitSeconds: 30,
      title: 'Daily Phone Quiz',
      topics: ['iPhone buying advice'],
    };
    const parsePayload = (overrides: Record<string, unknown>) =>
      merchantQuizGenerationRequestSchema.parse({
        ...basePayload,
        ...overrides,
      });

    expect(
      merchantQuizGenerationRequestSchema.parse({
        difficulty: 'hard',
        prizeProductId: PRODUCT_ID,
        prizeVariantId: VARIANT_ID,
        questionCountPerTopic: '2',
        timeLimitSeconds: '45',
        title: 'Daily Phone Quiz',
        topics: [' iPhone buying advice ', 'Android trade-in'],
      })
    ).toEqual({
      difficulty: 'hard',
      prizeProductId: PRODUCT_ID,
      prizeVariantId: VARIANT_ID,
      questionCountPerTopic: 2,
      timeLimitSeconds: 45,
      title: 'Daily Phone Quiz',
      topics: ['iPhone buying advice', 'Android trade-in'],
    });

    expect(() =>
      merchantQuizGenerationRequestSchema.parse({
        prizeProductId: PRODUCT_ID,
        title: 'No',
        topics: ['iPhone buying advice'],
      })
    ).toThrow();
    expect(() =>
      merchantQuizGenerationRequestSchema.parse({
        prizeProductId: PRODUCT_ID,
        title: 'Daily Phone Quiz',
        topics: [],
      })
    ).toThrow();
    expect(() =>
      merchantQuizGenerationRequestSchema.parse({
        difficulty: 'expert',
        prizeProductId: PRODUCT_ID,
        title: 'Daily Phone Quiz',
        topics: ['iPhone buying advice'],
      })
    ).toThrow();

    expect(parsePayload({ title: 'T'.repeat(120) }).title).toBe(
      'T'.repeat(120)
    );
    expect(() => parsePayload({ title: 'T'.repeat(121) })).toThrow();

    expect(parsePayload({ topics: [' abc '] }).topics).toEqual(['abc']);
    expect(parsePayload({ topics: ['a'.repeat(80)] }).topics).toEqual([
      'a'.repeat(80),
    ]);
    expect(() => parsePayload({ topics: ['ab'] })).toThrow();
    expect(() => parsePayload({ topics: ['a'.repeat(81)] })).toThrow();
    expect(
      parsePayload({
        topics: Array.from({ length: 10 }, (_, index) => `topic ${index}`),
      }).topics
    ).toHaveLength(10);
    expect(() =>
      parsePayload({
        topics: Array.from({ length: 11 }, (_, index) => `topic ${index}`),
      })
    ).toThrow();

    expect(
      parsePayload({ questionCountPerTopic: 1 }).questionCountPerTopic
    ).toBe(1);
    expect(
      parsePayload({ questionCountPerTopic: 5 }).questionCountPerTopic
    ).toBe(5);
    expect(() => parsePayload({ questionCountPerTopic: 0 })).toThrow();
    expect(() => parsePayload({ questionCountPerTopic: 6 })).toThrow();

    expect(parsePayload({ timeLimitSeconds: 5 }).timeLimitSeconds).toBe(5);
    expect(parsePayload({ timeLimitSeconds: 60 }).timeLimitSeconds).toBe(60);
    expect(() => parsePayload({ timeLimitSeconds: 4 })).toThrow();
    expect(() => parsePayload({ timeLimitSeconds: 61 })).toThrow();

    expect(parsePayload({ prizeProductId: PRODUCT_ID }).prizeProductId).toBe(
      PRODUCT_ID
    );
    expect(parsePayload({ prizeVariantId: VARIANT_ID }).prizeVariantId).toBe(
      VARIANT_ID
    );
    expect(() =>
      parsePayload({ prizeProductId: 'not-a-product-id' })
    ).toThrow();
    expect(() =>
      parsePayload({ prizeVariantId: 'not-a-variant-id' })
    ).toThrow();
  });

  it('requires an explicit confirmation flag to activate a draft quiz', () => {
    expect(
      merchantQuizActivationRequestSchema.parse({
        answerKeyReview: {
          questions: [{ correctOptionId: 'a', position: 1 }],
        },
        confirmActivation: true,
        eventId: EVENT_ID,
      })
    ).toEqual({
      answerKeyReview: {
        questions: [{ correctOptionId: 'a', position: 1 }],
      },
      confirmActivation: true,
      eventId: EVENT_ID,
    });

    // Must not activate without the explicit confirmation flag.
    expect(() =>
      merchantQuizActivationRequestSchema.parse({
        answerKeyReview: {
          questions: [{ correctOptionId: 'a', position: 1 }],
        },
        eventId: EVENT_ID,
      })
    ).toThrow();
    expect(() =>
      merchantQuizActivationRequestSchema.parse({
        answerKeyReview: {
          questions: [{ correctOptionId: 'a', position: 1 }],
        },
        confirmActivation: false,
        eventId: EVENT_ID,
      })
    ).toThrow();
    expect(() =>
      merchantQuizActivationRequestSchema.parse({
        confirmActivation: true,
        eventId: EVENT_ID,
      })
    ).toThrow();
    expect(() =>
      merchantQuizActivationRequestSchema.parse({
        answerKeyReview: { questions: [] },
        confirmActivation: true,
        eventId: EVENT_ID,
      })
    ).toThrow();
    expect(() =>
      merchantQuizActivationRequestSchema.parse({
        answerKeyReview: {
          questions: [{ correctOptionId: 'a', position: 1 }],
        },
        confirmActivation: true,
        eventId: 'not-a-uuid',
      })
    ).toThrow();
  });
});
