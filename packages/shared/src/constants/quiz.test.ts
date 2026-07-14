import { describe, expect, it } from 'vitest';
import {
  EXAM_PASS_POINTS_COST,
  QUIZ_FREE_ENTRY_MODE,
  QUIZ_FREE_ENTRY_RPC_ACTION,
} from './quiz';

describe('quiz constants', () => {
  it('charges nothing to enter a quiz, so entry is not purchase-gated', () => {
    expect(typeof EXAM_PASS_POINTS_COST).toBe('number');
    expect(Number.isInteger(EXAM_PASS_POINTS_COST)).toBe(true);
    expect(EXAM_PASS_POINTS_COST).toBe(0);
  });

  it('pins the free-entry client protocol marker', () => {
    expect(QUIZ_FREE_ENTRY_MODE).toBe('free-v1');
    expect(QUIZ_FREE_ENTRY_RPC_ACTION).toBe('start_quiz_attempt_free_v1');
  });
});
