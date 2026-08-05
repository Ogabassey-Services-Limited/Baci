import type {
  QuizLeaderboardEntry,
  QuizLeaderboardRow,
} from '@/schemas/quiz-leaderboard';

const ANONYMOUS_DISPLAY_NAME = 'Anonymous player';

function canonicalizeTimestamp(value: string | null): string | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

/**
 * Projects rows from the privacy-safe v2 leaderboard RPC into the API shape.
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
    const displayName =
      typeof row.customer_name === 'string' && row.customer_name.trim()
        ? row.customer_name.trim()
        : ANONYMOUS_DISPLAY_NAME;

    return {
      // The database always supplies either the immutable attempt snapshot or
      // a stable event-scoped alias. Never derive a name from customer PII here.
      displayName,
      isCurrentCustomer: row.is_current_customer ?? false,
      rank: Number.isFinite(rank) && rank > 0 ? rank : 0,
      score: row.score ?? 0,
      status: row.status ?? 'unknown',
      submittedAt: canonicalizeTimestamp(row.submitted_at),
      totalTimeSeconds: row.total_time_seconds ?? null,
    };
  });
}
