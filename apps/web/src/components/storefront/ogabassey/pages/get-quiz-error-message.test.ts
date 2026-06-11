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
});
