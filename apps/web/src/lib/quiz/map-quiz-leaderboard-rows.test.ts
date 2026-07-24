import { describe, expect, it } from 'vitest';
import type { QuizLeaderboardRow } from '@/schemas/quiz-leaderboard';
import { mapQuizLeaderboardRows } from './map-quiz-leaderboard-rows';

function row(overrides: Partial<QuizLeaderboardRow> = {}): QuizLeaderboardRow {
  return {
    customer_name: 'quizking',
    is_current_customer: false,
    rank: 1,
    score: 5,
    status: 'scored',
    submitted_at: '2026-07-14T09:03:00.000Z',
    total_time_seconds: 42.5,
    ...overrides,
  };
}

describe('mapQuizLeaderboardRows', () => {
  it('projects a row to the public shape', () => {
    const [entry] = mapQuizLeaderboardRows([row()]);

    expect(entry).toEqual({
      displayName: 'quizking',
      isCurrentCustomer: false,
      rank: 1,
      score: 5,
      status: 'scored',
      submittedAt: '2026-07-14T09:03:00.000Z',
      totalTimeSeconds: 42.5,
    });
  });

  it('never leaks internal ids to the client', () => {
    const [entry] = mapQuizLeaderboardRows([row()]);

    expect(entry).not.toHaveProperty('customer_id');
    expect(entry).not.toHaveProperty('attempt_id');
  });

  it('carries the RPC-computed self flag through', () => {
    const entries = mapQuizLeaderboardRows([
      row({ customer_name: 'rival', is_current_customer: false }),
      row({ customer_name: 'myname', is_current_customer: true, rank: 2 }),
    ]);

    expect(entries[0]?.isCurrentCustomer).toBe(false);
    expect(entries[1]?.isCurrentCustomer).toBe(true);
  });

  it('defaults a null self flag to false', () => {
    const [entry] = mapQuizLeaderboardRows([
      row({ is_current_customer: null }),
    ]);

    expect(entry?.isCurrentCustomer).toBe(false);
  });

  it('coerces a bigint rank delivered as a string', () => {
    const [entry] = mapQuizLeaderboardRows([row({ rank: '3' })]);

    expect(entry?.rank).toBe(3);
  });

  it('falls back to an anonymous label rather than rendering a blank row', () => {
    const blank = mapQuizLeaderboardRows([row({ customer_name: '  ' })]);
    const missing = mapQuizLeaderboardRows([row({ customer_name: null })]);

    expect(blank[0]?.displayName).toBe('Anonymous player');
    expect(missing[0]?.displayName).toBe('Anonymous player');
  });

  it('tolerates null score and timing from an unsubmitted attempt', () => {
    const [entry] = mapQuizLeaderboardRows([
      row({ score: null, submitted_at: null, total_time_seconds: null }),
    ]);

    expect(entry?.score).toBe(0);
    expect(entry?.submittedAt).toBeNull();
    expect(entry?.totalTimeSeconds).toBeNull();
  });
});
