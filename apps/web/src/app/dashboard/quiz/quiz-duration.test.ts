import { describe, expect, it } from 'vitest';
import { formatQuizDuration } from './quiz-duration';

describe('formatQuizDuration', () => {
  it('formats seconds and minutes without losing the remainder', () => {
    expect(formatQuizDuration(20)).toBe('20s');
    expect(formatQuizDuration(90)).toBe('1m 30s');
    expect(formatQuizDuration(120)).toBe('2m');
  });
});
