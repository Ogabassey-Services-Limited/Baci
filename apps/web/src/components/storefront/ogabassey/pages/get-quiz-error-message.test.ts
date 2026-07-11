import { describe, expect, it } from 'vitest';
import { getQuizErrorMessage } from './get-quiz-error-message';

describe('getQuizErrorMessage', () => {
  it('returns Error messages and falls back for unknown failures', () => {
    expect(getQuizErrorMessage(new Error('Network failed'))).toBe(
      'Network failed'
    );
    expect(getQuizErrorMessage('bad')).toBe(
      'Quiz action failed. Please try again.'
    );
  });

  it('maps the per-event attempt cap (QZ030 / attempt_limit_reached) to friendly copy', () => {
    const expected =
      "You've reached the maximum number of attempts for this quiz.";
    expect(getQuizErrorMessage(new Error('attempt_limit_reached'))).toBe(
      expected
    );
    expect(getQuizErrorMessage(new Error('QZ030'))).toBe(expected);
  });
});
