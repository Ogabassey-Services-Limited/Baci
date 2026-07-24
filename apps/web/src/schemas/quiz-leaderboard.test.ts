import { describe, expect, it } from 'vitest';
import {
  quizLeaderboardEntrySchema,
  quizLeaderboardQuerySchema,
  quizLeaderboardResponseSchema,
  quizLeaderboardRowSchema,
} from './quiz-leaderboard';

const VALID_ENTRY = {
  displayName: 'quizking',
  isCurrentCustomer: true,
  rank: 1,
  score: 5,
  status: 'scored',
  submittedAt: '2026-07-14T09:00:00.000Z',
  totalTimeSeconds: 30.5,
};

describe('quizLeaderboardEntrySchema', () => {
  it('accepts a well-formed entry', () => {
    expect(quizLeaderboardEntrySchema.parse(VALID_ENTRY)).toEqual(VALID_ENTRY);
  });

  it('rejects a blank display name so no empty row can render', () => {
    expect(
      quizLeaderboardEntrySchema.safeParse({ ...VALID_ENTRY, displayName: '' })
        .success
    ).toBe(false);
  });

  it('rejects a non-positive rank', () => {
    expect(
      quizLeaderboardEntrySchema.safeParse({ ...VALID_ENTRY, rank: 0 }).success
    ).toBe(false);
  });

  it('rejects a negative score', () => {
    expect(
      quizLeaderboardEntrySchema.safeParse({ ...VALID_ENTRY, score: -1 })
        .success
    ).toBe(false);
  });

  it('allows a null completion time and submitted timestamp', () => {
    const parsed = quizLeaderboardEntrySchema.parse({
      ...VALID_ENTRY,
      submittedAt: null,
      totalTimeSeconds: null,
    });

    expect(parsed.submittedAt).toBeNull();
    expect(parsed.totalTimeSeconds).toBeNull();
  });

  it('has no loyalty-point field — standings are skill and speed only', () => {
    expect(Object.keys(quizLeaderboardEntrySchema.shape)).not.toContain(
      'loyaltyPoints'
    );
  });
});

describe('quizLeaderboardResponseSchema', () => {
  it('accepts an empty board', () => {
    expect(quizLeaderboardResponseSchema.parse({ entries: [] })).toEqual({
      entries: [],
    });
  });

  it('rejects a malformed entry inside the array', () => {
    expect(
      quizLeaderboardResponseSchema.safeParse({
        entries: [{ ...VALID_ENTRY, rank: -1 }],
      }).success
    ).toBe(false);
  });
});

describe('quizLeaderboardRowSchema', () => {
  it('accepts a bigint rank delivered as a string', () => {
    const parsed = quizLeaderboardRowSchema.parse({
      customer_name: 'quizking',
      is_current_customer: true,
      rank: '3',
      score: 5,
      status: 'scored',
      submitted_at: '2026-07-14T09:00:00.000Z',
      total_time_seconds: 30.5,
    });

    expect(parsed.rank).toBe('3');
    expect(parsed.is_current_customer).toBe(true);
  });

  it('tolerates null customer name, score, and self flag from an unranked row', () => {
    const parsed = quizLeaderboardRowSchema.parse({
      customer_name: null,
      is_current_customer: null,
      rank: 9,
      score: null,
      status: null,
      submitted_at: null,
      total_time_seconds: null,
    });

    expect(parsed.customer_name).toBeNull();
    expect(parsed.score).toBeNull();
  });

  it('never carries a customer id (the RPC no longer returns one)', () => {
    const parsed = quizLeaderboardRowSchema.parse({
      customer_id: 'leaked-id',
      customer_name: 'quizking',
      is_current_customer: false,
      rank: 1,
      score: 5,
      status: 'scored',
      submitted_at: '2026-07-14T09:00:00.000Z',
      total_time_seconds: 30.5,
    });

    expect(parsed).not.toHaveProperty('customer_id');
  });
});

describe('quizLeaderboardQuerySchema', () => {
  it('accepts a uuid eventId', () => {
    expect(
      quizLeaderboardQuerySchema.safeParse({
        eventId: '11111111-1111-4111-8111-111111111111',
      }).success
    ).toBe(true);
  });

  it('rejects a missing or non-uuid eventId', () => {
    expect(quizLeaderboardQuerySchema.safeParse({}).success).toBe(false);
    expect(
      quizLeaderboardQuerySchema.safeParse({ eventId: 'nope' }).success
    ).toBe(false);
  });
});
