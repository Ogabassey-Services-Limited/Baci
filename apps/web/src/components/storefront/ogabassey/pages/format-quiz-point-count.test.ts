import { describe, expect, it } from 'vitest';
import { formatQuizPointCount } from './format-quiz-point-count';

describe('formatQuizPointCount', () => {
  it('formats singular and plural loyalty points', () => {
    expect(formatQuizPointCount(1)).toBe('1 loyalty point');
    expect(formatQuizPointCount(3)).toBe('3 loyalty points');
  });
});
