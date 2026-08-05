import { describe, expect, it } from 'vitest';
import { quizEventsQuerySchema } from './quiz-schema-query';

describe('quiz query schemas', () => {
  it('coerces bounded event pagination values', () => {
    expect(
      quizEventsQuerySchema.parse({
        limit: '12',
        merchantId: '55555555-5555-4555-8555-555555555555',
        offset: '3',
      })
    ).toMatchObject({ limit: 12, offset: 3 });
    expect(
      quizEventsQuerySchema.safeParse({
        limit: '500',
        merchantId: '55555555-5555-4555-8555-555555555555',
      }).success
    ).toBe(false);
  });
});
