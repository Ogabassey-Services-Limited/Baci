import { QUIZ_FREE_ENTRY_MODE } from '@baci/shared/constants';
import { describe, expect, it } from 'vitest';
import {
  claimQuizCashAwardSchema,
  claimQuizGrandPrizeSchema,
  claimQuizTestInviteSchema,
  finalizeQuizAwardsSchema,
  startQuizAttemptSchema,
  startQuizAttemptV2RouteSchema,
  submitQuizAnswerSchema,
  submitQuizAnswerV2Schema,
} from '@/schemas/quiz';

const EVENT_ID = '11111111-1111-4111-8111-111111111111';
const ATTEMPT_ID = '22222222-2222-4222-8222-222222222222';
const QUESTION_ID = '33333333-3333-4333-8333-333333333333';
const AWARD_ID = '44444444-4444-4444-8444-444444444444';

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

  it('accepts only bounded strict test-invite tokens', () => {
    const token = 'a'.repeat(48);
    expect(claimQuizTestInviteSchema.parse({ token })).toEqual({ token });
    expect(claimQuizTestInviteSchema.parse({ token: 'a'.repeat(32) })).toEqual({
      token: 'a'.repeat(32),
    });
    expect(claimQuizTestInviteSchema.parse({ token: 'a'.repeat(512) })).toEqual(
      { token: 'a'.repeat(512) }
    );
    expect(() => claimQuizTestInviteSchema.parse({ token: 'short' })).toThrow();
    expect(() =>
      claimQuizTestInviteSchema.parse({ token: 'a'.repeat(513) })
    ).toThrow();
    expect(() =>
      claimQuizTestInviteSchema.parse({ token, userId: EVENT_ID })
    ).toThrow();
  });

  it('keeps v2 device identity out of request bodies', () => {
    const start = {
      acceptedRulesVersion: 'rules-v1',
      appVersion: '1.2.3',
      entryMode: QUIZ_FREE_ENTRY_MODE,
      eventId: EVENT_ID,
      expectedUserId: 'user-1',
      integrityTier: 'device' as const,
      platform: 'ios' as const,
      startRequestId: ATTEMPT_ID,
      termsAccepted: true as const,
    };
    expect(startQuizAttemptV2RouteSchema.parse(start)).toEqual(start);
    expect(() =>
      startQuizAttemptV2RouteSchema.parse({
        ...start,
        deviceFingerprint: 'a'.repeat(64),
      })
    ).toThrow();
    expect(
      submitQuizAnswerV2Schema.parse({ answer: 'A', questionId: QUESTION_ID })
    ).toEqual({ answer: 'A', questionId: QUESTION_ID });
    expect(() =>
      submitQuizAnswerV2Schema.parse({
        answer: 'A',
        integrityTier: 'device',
        questionId: QUESTION_ID,
      })
    ).toThrow();
  });
});
