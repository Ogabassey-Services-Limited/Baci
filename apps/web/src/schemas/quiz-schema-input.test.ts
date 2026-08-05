import { describe, expect, it } from 'vitest';
import { submitQuizAnswerV2Schema } from './quiz-schema-input';

describe('quiz input schemas', () => {
  it('requires a question and non-empty answer for v2 submissions', () => {
    expect(
      submitQuizAnswerV2Schema.safeParse({
        answer: 'option-a',
        questionId: '55555555-5555-4555-8555-555555555555',
      }).success
    ).toBe(true);
    expect(submitQuizAnswerV2Schema.safeParse({ answer: '' }).success).toBe(
      false
    );
  });
});
