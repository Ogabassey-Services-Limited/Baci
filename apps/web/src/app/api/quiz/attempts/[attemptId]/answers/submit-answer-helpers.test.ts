import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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

function decodeVoucherExpiry(token: string): string {
  // token = qv1.<base64url(JSON payload)>.<base64url sig>
  const payload = JSON.parse(
    Buffer.from(token.split('.')[1], 'base64url').toString('utf8')
  );
  return payload.expiresAt;
}

describe('addSignedPrizeClaim', () => {
  const ORIGINAL_SECRET = process.env.QUIZ_RPC_SERVER_SECRET;
  const winningData = {
    attemptId: 'a',
    correctAnswers: 3,
    prizeClaim: {
      awardId: '11111111-1111-4111-8111-111111111111',
      condition: 'new',
      productId: '22222222-2222-4222-8222-222222222222',
      variantId: null,
    },
  };

  beforeAll(() => {
    process.env.QUIZ_RPC_SERVER_SECRET = 'test-secret';
  });
  afterAll(() => {
    if (ORIGINAL_SECRET === undefined) {
      delete process.env.QUIZ_RPC_SERVER_SECRET;
    } else {
      process.env.QUIZ_RPC_SERVER_SECRET = ORIGINAL_SECRET;
    }
  });

  it('returns the payload unchanged when there is no prize claim', () => {
    const data = { attemptId: 'a', correctAnswers: 0 };
    expect(addSignedPrizeClaim(data, 'user-1')).toBe(data);
  });

  it('signs a fresh ~7-day expiry on the first-success path', () => {
    const result = addSignedPrizeClaim(
      winningData,
      '33333333-3333-4333-8333-333333333333'
    ) as {
      prizeClaim: { voucherToken: string };
    };
    const expiry = Date.parse(
      decodeVoucherExpiry(result.prizeClaim.voucherToken)
    );
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(Math.abs(expiry - (Date.now() + sevenDaysMs))).toBeLessThan(60_000);
  });

  it('honors an expiresAtOverride so a replay cannot extend the window', () => {
    // Award minted 6 days ago → re-issued token must keep the ORIGINAL expiry
    // (~1 day out), not a fresh 7 days.
    const original = new Date(
      Date.now() - 6 * 24 * 60 * 60 * 1000 + 7 * 24 * 60 * 60 * 1000
    ).toISOString();
    const result = addSignedPrizeClaim(
      winningData,
      '33333333-3333-4333-8333-333333333333',
      original
    ) as {
      prizeClaim: { voucherToken: string };
    };
    expect(decodeVoucherExpiry(result.prizeClaim.voucherToken)).toBe(original);
  });
});
