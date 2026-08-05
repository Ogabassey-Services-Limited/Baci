import { describe, expect, it } from 'vitest';
import {
  quizActiveAttemptQuerySchema,
  quizAttemptParamsSchema,
  quizContractVersionHeaderSchema,
  quizEventsQuerySchema,
} from '@/schemas/quiz';

const ATTEMPT_ID = '22222222-2222-4222-8222-222222222222';
const MERCHANT_ID = '55555555-5555-4555-8555-555555555555';

describe('quiz query schemas', () => {
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

  it('validates attempt route params centrally', () => {
    expect(quizAttemptParamsSchema.parse({ attemptId: ATTEMPT_ID })).toEqual({
      attemptId: ATTEMPT_ID,
    });
    expect(() =>
      quizAttemptParamsSchema.parse({ attemptId: 'not-a-uuid' })
    ).toThrow();
    expect(() => quizAttemptParamsSchema.parse({})).toThrow();
  });

  it('accepts only the explicit v2 client contract header', () => {
    expect(
      quizContractVersionHeaderSchema.parse({ 'x-baci-quiz-contract': '2' })
    ).toEqual({ 'x-baci-quiz-contract': 2 });
    expect(() =>
      quizContractVersionHeaderSchema.parse({ 'x-baci-quiz-contract': '1' })
    ).toThrow();
    expect(() => quizContractVersionHeaderSchema.parse({})).toThrow();
  });

  it('accepts only a UUID active-attempt selector', () => {
    expect(quizActiveAttemptQuerySchema.parse({ eventId: ATTEMPT_ID })).toEqual(
      {
        eventId: ATTEMPT_ID,
      }
    );
    expect(() =>
      quizActiveAttemptQuerySchema.parse({ eventId: 'bad' })
    ).toThrow();
    expect(() =>
      quizActiveAttemptQuerySchema.parse({
        eventId: ATTEMPT_ID,
        deviceFingerprint: 'leak',
      })
    ).toThrow();
  });
});
