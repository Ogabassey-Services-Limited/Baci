import { describe, expect, it, vi } from 'vitest';
import {
  isReplayStateError,
  mapSubmittedAttemptScore,
  recoverReplayedAttemptResponse,
} from './submit-answer-helpers';

function createSupabaseForRecoveredAward(createdAt: unknown) {
  const attemptQuery = createQueryResult({
    data: {
      status: 'submitted',
      quiz_attempt_questions: [{ quiz_attempt_answers: [{ score_delta: 1 }] }],
    },
    error: null,
  });
  const awardQuery = createQueryResult({
    data: {
      condition: 'new',
      created_at: createdAt,
      id: '11111111-1111-4111-8111-111111111111',
      product_id: '22222222-2222-4222-8222-222222222222',
      variant_id: null,
    },
    error: null,
  });

  return {
    from: vi.fn((table: string) =>
      table === 'quiz_attempts' ? attemptQuery : awardQuery
    ),
  };
}

function createQueryResult(result: { data: unknown; error: unknown }) {
  const query = {
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => result),
    select: vi.fn(() => query),
  };
  return query;
}

describe('isReplayStateError', () => {
  it('recognizes the replay-recoverable RPC codes', () => {
    expect(isReplayStateError({ code: 'QZ004' })).toBe(true);
    expect(isReplayStateError({ code: 'QZ026' })).toBe(true);
    expect(isReplayStateError({ code: 'QZ029' })).toBe(false);
    expect(isReplayStateError(null)).toBe(false);
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

describe('recoverReplayedAttemptResponse', () => {
  it.each([
    null,
    'not-a-date',
  ])('fails closed when the recovered award created_at is %s', async (createdAt) => {
    const response = await recoverReplayedAttemptResponse(
      createSupabaseForRecoveredAward(createdAt) as never,
      '33333333-3333-4333-8333-333333333333',
      '44444444-4444-4444-8444-444444444444'
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Quiz request failed',
    });
  });
});
