import { describe, expect, it } from 'vitest';
import type { QuizLeaderboardRow } from '@/schemas/quiz-leaderboard';
import { mapQuizLeaderboardRows } from './map-quiz-leaderboard-rows';

function row(overrides: Partial<QuizLeaderboardRow> = {}): QuizLeaderboardRow {
  return {
    customer_name: 'captured_handle',
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
  it('preserves the database-supplied snapshot or privacy alias', () => {
    expect(
      mapQuizLeaderboardRows([
        row(),
        row({ customer_name: 'Player-A1B2C3D4', rank: '101' }),
      ])
    ).toEqual([
      {
        displayName: 'captured_handle',
        isCurrentCustomer: false,
        rank: 1,
        score: 5,
        status: 'scored',
        submittedAt: '2026-07-14T09:03:00.000Z',
        totalTimeSeconds: 42.5,
      },
      {
        displayName: 'Player-A1B2C3D4',
        isCurrentCustomer: false,
        rank: 101,
        score: 5,
        status: 'scored',
        submittedAt: '2026-07-14T09:03:00.000Z',
        totalTimeSeconds: 42.5,
      },
    ]);
  });

  it('carries the RPC-computed current-player flag through', () => {
    const [entry] = mapQuizLeaderboardRows([
      row({ is_current_customer: true }),
    ]);

    expect(entry?.isCurrentCustomer).toBe(true);
  });

  it('never exposes internal identifiers', () => {
    const [entry] = mapQuizLeaderboardRows([row()]);

    expect(entry).not.toHaveProperty('customer_id');
    expect(entry).not.toHaveProperty('attempt_id');
  });

  it('normalizes nullable scoring fields without inventing identity', () => {
    const [entry] = mapQuizLeaderboardRows([
      row({
        is_current_customer: null,
        score: null,
        status: null,
        submitted_at: null,
        total_time_seconds: null,
      }),
    ]);

    expect(entry).toMatchObject({
      displayName: 'captured_handle',
      isCurrentCustomer: false,
      score: 0,
      status: 'unknown',
      submittedAt: null,
      totalTimeSeconds: null,
    });
  });

  it('uses an anonymous fallback for a null-safe database row', () => {
    const [entry] = mapQuizLeaderboardRows([
      row({ customer_name: null as never, submitted_at: 'not-a-date' }),
    ]);

    expect(entry).toMatchObject({
      displayName: 'Anonymous player',
      submittedAt: null,
    });
  });

  it('canonicalizes a valid submitted timestamp', () => {
    const [entry] = mapQuizLeaderboardRows([
      row({ submitted_at: '2026-07-14T10:03:00+01:00' }),
    ]);

    expect(entry?.submittedAt).toBe('2026-07-14T09:03:00.000Z');
  });
});
