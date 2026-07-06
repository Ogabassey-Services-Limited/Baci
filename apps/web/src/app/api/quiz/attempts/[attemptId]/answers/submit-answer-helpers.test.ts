import { describe, expect, it } from 'vitest';
import {
  addSignedPrizeClaim,
  getRawPrizeClaim,
  isReplayStateError,
  mapSubmittedAttemptScore,
  normalizePrizeCondition,
} from './submit-answer-helpers';

describe('normalizePrizeCondition', () => {
  it('passes through valid conditions and nulls the rest', () => {
    expect(normalizePrizeCondition('new')).toBe('new');
    expect(normalizePrizeCondition('refurbished')).toBe('refurbished');
    expect(normalizePrizeCondition('unknown')).toBeNull();
    expect(normalizePrizeCondition(undefined)).toBeNull();
  });
});

describe('isReplayStateError', () => {
  it('recognizes the replay-recoverable RPC codes', () => {
    expect(isReplayStateError({ code: 'QZ004' })).toBe(true);
    expect(isReplayStateError({ code: 'QZ026' })).toBe(true);
    expect(isReplayStateError({ code: 'QZ029' })).toBe(false);
    expect(isReplayStateError(null)).toBe(false);
  });
});

describe('getRawPrizeClaim', () => {
  it('extracts a well-formed prize claim', () => {
    expect(
      getRawPrizeClaim({
        prizeClaim: {
          awardId: 'a1',
          condition: 'used',
          productId: 'p1',
          variantId: 'v1',
        },
      })
    ).toEqual({
      awardId: 'a1',
      condition: 'used',
      productId: 'p1',
      variantId: 'v1',
    });
  });

  it('returns null when required ids are missing', () => {
    expect(getRawPrizeClaim({ prizeClaim: { awardId: 'a1' } })).toBeNull();
    expect(getRawPrizeClaim({})).toBeNull();
  });
});

describe('mapSubmittedAttemptScore', () => {
  it('tallies score_delta across submitted questions', () => {
    expect(
      mapSubmittedAttemptScore({
        status: 'submitted',
        quiz_attempt_questions: [
          { quiz_attempt_answers: [{ score_delta: 1 }] },
          { quiz_attempt_answers: [{ score_delta: 0 }] },
        ],
      })
    ).toEqual({ correctAnswers: 1, totalQuestions: 2 });
  });

  it('returns null for non-submitted or empty attempts', () => {
    expect(
      mapSubmittedAttemptScore({
        status: 'started',
        quiz_attempt_questions: [],
      })
    ).toBeNull();
    expect(mapSubmittedAttemptScore(null)).toBeNull();
  });
});

describe('addSignedPrizeClaim', () => {
  it('returns the payload unchanged when there is no prize claim', () => {
    const data = { attemptId: 'a', correctAnswers: 0 };
    expect(addSignedPrizeClaim(data, 'user-1')).toBe(data);
  });
});
