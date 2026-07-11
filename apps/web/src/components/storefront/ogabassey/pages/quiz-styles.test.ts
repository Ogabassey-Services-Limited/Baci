import { describe, expect, it } from 'vitest';
import { quizPanel, quizPrimaryButton, quizSecondaryButton } from './quiz-styles';

describe('quiz-styles', () => {
  it('exports non-empty class strings for every shared style token', () => {
    for (const className of [quizPrimaryButton, quizSecondaryButton, quizPanel]) {
      expect(typeof className).toBe('string');
      expect(className.trim().length).toBeGreaterThan(0);
    }
  });
});
