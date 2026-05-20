import { describe, expect, it } from 'vitest';
import { EXAM_PASS_POINTS_COST } from './quiz';

describe('quiz constants', () => {
  it('defines a positive integer exam pass cost of one loyalty point', () => {
    expect(typeof EXAM_PASS_POINTS_COST).toBe('number');
    expect(Number.isInteger(EXAM_PASS_POINTS_COST)).toBe(true);
    expect(EXAM_PASS_POINTS_COST).toBe(1);
  });
});
