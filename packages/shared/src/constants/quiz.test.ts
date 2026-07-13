import { describe, expect, it } from 'vitest';
import { EXAM_PASS_POINTS_COST } from './quiz';

describe('quiz constants', () => {
  it('charges nothing to enter a quiz, so entry is not purchase-gated', () => {
    expect(typeof EXAM_PASS_POINTS_COST).toBe('number');
    expect(Number.isInteger(EXAM_PASS_POINTS_COST)).toBe(true);
    expect(EXAM_PASS_POINTS_COST).toBe(0);
  });
});
