import { describe, expect, it } from 'vitest';
import { getQuizStartButtonText } from './get-quiz-start-button-text';

describe('getQuizStartButtonText', () => {
  it('formats quiz start button state labels', () => {
    expect(getQuizStartButtonText({ status: 'open' }, true)).toBe(
      'Starting...'
    );
    expect(getQuizStartButtonText({ status: 'scheduled' }, false)).toBe(
      'Coming soon'
    );
    expect(getQuizStartButtonText({ status: 'closed' }, false)).toBe('Closed');
    expect(getQuizStartButtonText({ status: 'open' }, false)).toBe(
      'Start exam'
    );
  });
});
