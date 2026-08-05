import { describe, expect, it } from 'vitest';
import { quizEventQuestionCountRowSchema } from './quiz-schema-row';

describe('quiz row schemas', () => {
  it('validates the safe event question-count projection', () => {
    expect(
      quizEventQuestionCountRowSchema.safeParse({
        event_id: '55555555-5555-4555-8555-555555555555',
        question_count: 20,
      }).success
    ).toBe(true);
  });
});
