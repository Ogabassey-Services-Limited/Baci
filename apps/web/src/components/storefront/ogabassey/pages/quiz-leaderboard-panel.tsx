import type { QuizLeaderboardEntry } from '@/schemas/quiz-leaderboard';
import { quizPanel } from './quiz-styles';

interface QuizLeaderboardPanelProps {
  entries: QuizLeaderboardEntry[];
  isLoading: boolean;
  error: string | null;
}

function formatCompletionTime(totalTimeSeconds: number | null): string {
  if (totalTimeSeconds === null) return '—';
  return `${totalTimeSeconds.toFixed(1)}s`;
}

/**
 * Presentational leaderboard. Pure by design — the parent owns fetching, so this
 * renders loading / error / empty / populated purely from props and stays a
 * Server Component. Standings are skill and speed (score, then completion time);
 * loyalty points are neither shown nor used, so purchases never affect rank.
 */
export function QuizLeaderboardPanel({
  entries,
  isLoading,
  error,
}: QuizLeaderboardPanelProps) {
  return (
    <section aria-labelledby="quiz-leaderboard-heading" className={quizPanel}>
      <h2
        className="text-lg font-semibold text-store-background-text"
        id="quiz-leaderboard-heading"
      >
        Leaderboard
      </h2>

      {isLoading ? (
        <p aria-live="polite" className="mt-3 text-sm text-store-background-text/70">
          Loading the leaderboard…
        </p>
      ) : error ? (
        // Themed error: merchants can override via --store-danger-* CSS vars,
        // falling back to a red palette. Matches the sibling storefront error
        // component (imei-checker-error.tsx) rather than hard-coding Tailwind red.
        <p
          className="mt-3 rounded-lg border border-[var(--store-danger-border,#fecaca)] bg-[var(--store-danger-bg,#fef2f2)] p-3 text-sm font-medium text-[var(--store-danger-text,#b91c1c)]"
          role="alert"
        >
          {error}
        </p>
      ) : entries.length === 0 ? (
        <p className="mt-3 text-sm text-store-background-text/70">
          No scores yet. Be the first to play.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase text-store-background-text/60">
                <th className="py-2 pr-3 font-semibold" scope="col">
                  Rank
                </th>
                <th className="py-2 pr-3 font-semibold" scope="col">
                  Player
                </th>
                <th className="py-2 pr-3 text-right font-semibold" scope="col">
                  Score
                </th>
                <th className="py-2 text-right font-semibold" scope="col">
                  Time
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  className={
                    entry.isCurrentCustomer
                      ? 'border-t border-store-border bg-store-primary/5 font-semibold text-store-primary'
                      : 'border-t border-store-border text-store-background-text'
                  }
                  key={`${entry.rank}-${entry.displayName}`}
                >
                  <td className="py-2 pr-3 tabular-nums">{entry.rank}</td>
                  <td className="py-2 pr-3">
                    {entry.displayName}
                    {entry.isCurrentCustomer ? (
                      <span className="ml-2 text-xs font-normal text-store-primary/70">
                        (you)
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {entry.score}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {formatCompletionTime(entry.totalTimeSeconds)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
