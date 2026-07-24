'use client';

import Link from 'next/link';
import { asRoute } from '@/lib/routes';
import type { QuizResultResponse } from '@/schemas/quiz';
import { QuizLeaderboardPanel } from './quiz-leaderboard-panel';
import { quizPanel, quizPrimaryButton, quizSecondaryButton } from './quiz-styles';
import { useQuizLeaderboard } from './use-quiz-leaderboard';

interface QuizResultPanelProps {
  result: QuizResultResponse;
  /** The event the player just finished, used to load its leaderboard. */
  eventId: string | null;
  onBackToQuizzes: () => void;
}

/**
 * The post-attempt view: the player's score, an optional prize-claim link, and
 * the event leaderboard. Extracted from the quiz page so that page stays within
 * the size limit and the leaderboard fetch lifecycle lives with the view that
 * needs it.
 */
export function QuizResultPanel({
  result,
  eventId,
  onBackToQuizzes,
}: QuizResultPanelProps) {
  const { entries, error, isLoading } = useQuizLeaderboard(eventId);

  return (
    <div className="flex flex-col gap-4">
      <section className={quizPanel} role="status">
        <h2 className="text-lg font-semibold">Result</h2>
        <p className="mt-2 text-3xl font-bold text-store-primary">
          {result.correctAnswers} of {result.totalQuestions}
        </p>
        <p className="mt-2 text-sm text-store-background-text/70">
          {result.prizeEligible
            ? 'Prize entry recorded.'
            : 'Practice result recorded.'}
        </p>
        {result.prizeClaim ? (
          <Link
            className={`mt-5 inline-flex items-center justify-center ${quizPrimaryButton}`}
            href={asRoute(result.prizeClaim.cartPath)}
          >
            Add gift to cart
          </Link>
        ) : null}
        <button
          className={`${result.prizeClaim ? 'ml-0 mt-3 block' : 'mt-5'} ${quizSecondaryButton}`}
          onClick={onBackToQuizzes}
          type="button"
        >
          Back to quizzes
        </button>
      </section>

      <QuizLeaderboardPanel
        entries={entries}
        error={error}
        isLoading={isLoading}
      />
    </div>
  );
}
