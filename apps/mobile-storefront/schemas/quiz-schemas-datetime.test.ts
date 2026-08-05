import { describe, expect, it } from '@jest/globals';
import { quizEventSchema } from './quiz-schemas';
import { validLegacyQuizEvent } from './quiz-schemas.test-support';

describe('quiz event datetime schemas', () => {
  it('requires ISO 8601 datetimes for event windows', () => {
    expect(
      quizEventSchema.safeParse({
        ...validLegacyQuizEvent,
        endsAt: null,
        startsAt: null,
      }).success
    ).toBe(true);
    expect(
      quizEventSchema.safeParse({
        ...validLegacyQuizEvent,
        startsAt: 'tomorrow',
      }).success
    ).toBe(false);
    expect(
      quizEventSchema.safeParse({
        ...validLegacyQuizEvent,
        endsAt: '2026-05-20',
      }).success
    ).toBe(false);
  });

  it('accepts Supabase offsets and rejects datetimes without them', () => {
    expect(
      quizEventSchema.safeParse({
        ...validLegacyQuizEvent,
        endsAt: '2026-05-20T11:10:00+01:00',
        startsAt: '2026-05-20T10:00:00.123456+00:00',
      }).success
    ).toBe(true);
    expect(
      quizEventSchema.safeParse({
        ...validLegacyQuizEvent,
        startsAt: '2026-05-20T10:00:00',
      }).success
    ).toBe(false);
    expect(
      quizEventSchema.safeParse({
        ...validLegacyQuizEvent,
        endsAt: '2026-05-20T10:10:00.123',
      }).success
    ).toBe(false);
  });
});
