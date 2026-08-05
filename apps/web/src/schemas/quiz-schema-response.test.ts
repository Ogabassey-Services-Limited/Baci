import { describe, expect, it } from 'vitest';
import { quizEventsResponseSchema } from './quiz-schema-response';

describe('quiz response schemas', () => {
  it('rejects malformed event payloads', () => {
    expect(
      quizEventsResponseSchema.safeParse({ events: 'invalid' }).success
    ).toBe(false);
  });
});
