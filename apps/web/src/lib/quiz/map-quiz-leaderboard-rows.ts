import type {
  QuizLeaderboardEntry,
  QuizLeaderboardRow,
} from '@/schemas/quiz-leaderboard';

const ANONYMOUS_DISPLAY_NAME = 'Anonymous player';

/**
 * Projects raw `get_quiz_leaderboard` rows into the public shape.
 *
 * The RPC already returns rows in rank order, bounded, with `is_current_customer`
 * computed per row — so this is a pure field rename with no caller-side identity
 * lookup. `rank` is a Postgres bigint, which arrives over PostgREST as a JSON
 * number or a string depending on magnitude; both are coerced.
 */
export function mapQuizLeaderboardRows(
  rows: QuizLeaderboardRow[]
): QuizLeaderboardEntry[] {
  return rows.map((row) => {
    const rank = Number(row.rank);
    const displayName = row.customer_name?.trim();

    return {
      // A blank name would render an empty row. Never fall back to an email or
      // an id — the leaderboard promises players are announced by username.
      displayName: displayName || ANONYMOUS_DISPLAY_NAME,
      isCurrentCustomer: row.is_current_customer ?? false,
      rank: Number.isFinite(rank) && rank > 0 ? rank : 0,
      score: row.score ?? 0,
      status: row.status ?? 'unknown',
      submittedAt: row.submitted_at ?? null,
      totalTimeSeconds: row.total_time_seconds ?? null,
    };
  });
}
