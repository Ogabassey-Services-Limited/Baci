'use client';

import type { QuizAttemptResponse } from '@/schemas/quiz';
import { DeferredAdUnit } from '../components/deferred-ad-unit';
import { QuizQuestionAdFallback } from './quiz-question-ad-fallback';
import { quizPanel, quizPrimaryButton } from './quiz-styles';
import { useQuizCountdown } from './use-quiz-countdown';

interface QuizQuestionPanelProps {
  attempt: QuizAttemptResponse;
  isSubmitting: boolean;
  onAutoSubmit: () => void;
  onSelect: (optionId: string) => void;
  onSubmit: () => void;
  selectedAnswer: string | null;
}

const LOW_TIME_WARNING_SECONDS = 5;
const ANNOUNCE_THRESHOLD_SECONDS = 10;

function getCountdownAnnouncement(remainingSeconds: number): string {
  if (remainingSeconds > ANNOUNCE_THRESHOLD_SECONDS) return '';
  if (remainingSeconds <= 0) return 'Time is up. Submitting your answer.';
  return `${remainingSeconds} seconds remaining`;
}

/**
 * Renders a single quiz question with a visible per-question countdown. It
 * fires `onAutoSubmit` so a slow player never silently blows the server window
 * (FIX A): at the auto-submit lead when an option is selected, or at the real
 * deadline when nothing is selected (a forfeit) so a still-deciding player is
 * never cut off ~1.5s early. Keyed by question id in the parent, so a new
 * question remounts this panel and restarts the timer.
 */
export function QuizQuestionPanel({
  attempt,
  isSubmitting,
  onAutoSubmit,
  onSelect,
  onSubmit,
  selectedAnswer,
}: QuizQuestionPanelProps) {
  const remainingSeconds = useQuizCountdown({
    active: !isSubmitting,
    deadlineAt: attempt.question.deadlineAt,
    hasSelectedAnswer: selectedAnswer !== null,
    onExpire: onAutoSubmit,
    questionId: attempt.question.id,
    timeLimitSeconds: attempt.question.timeLimitSeconds,
  });

  const progress = Math.min(
    100,
    (attempt.question.index / attempt.question.total) * 100
  );
  const isLowTime = remainingSeconds <= LOW_TIME_WARNING_SECONDS;

  return (
    <section className={quizPanel}>
      <div
        aria-label={`Question ${attempt.question.index} of ${attempt.question.total}`}
        aria-valuemax={attempt.question.total}
        aria-valuemin={1}
        aria-valuenow={attempt.question.index}
        role="progressbar"
        className="h-2 overflow-hidden rounded-full bg-store-secondary"
      >
        <div
          className="h-full rounded-full bg-store-primary"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <p
          aria-hidden="true"
          className={`text-sm font-semibold ${isLowTime ? 'text-red-600' : 'text-store-primary'}`}
        >
          {remainingSeconds}s remaining
        </p>
        <span className="text-xs text-store-background-text/60">
          {attempt.question.timeLimitSeconds}s per question
        </span>
      </div>
      {/* Coarse, screen-reader-only countdown announcements limited to the
          final seconds so assistive tech is not flooded every tick. */}
      <span aria-atomic="true" aria-live="assertive" className="sr-only">
        {getCountdownAnnouncement(remainingSeconds)}
      </span>
      <p className="mt-2 text-xs text-store-background-text/60">
        Free entry — no loyalty points used.
      </p>
      <h2 className="mt-5 text-xl font-bold">{attempt.question.prompt}</h2>
      <DeferredAdUnit
        fallback={<QuizQuestionAdFallback />}
        loadStrategy="immediate"
        placementKey="QUIZ_QUESTION_MPU"
        refreshKey={attempt.question.id}
        timeoutMs={3000}
      />
      <div className="mt-5 grid gap-3">
        {attempt.question.options.map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={isSubmitting}
            aria-pressed={selectedAnswer === option.id}
            onClick={() => onSelect(option.id)}
            className={
              selectedAnswer === option.id
                ? 'rounded-lg border border-store-primary bg-store-primary/10 px-4 py-3 text-left text-sm font-semibold text-store-primary'
                : 'rounded-lg border border-store-border bg-store-background px-4 py-3 text-left text-sm font-semibold hover:border-store-primary/50'
            }
          >
            {option.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={!selectedAnswer || isSubmitting}
        onClick={onSubmit}
        className={`mt-5 w-full ${quizPrimaryButton}`}
      >
        {isSubmitting ? 'Submitting...' : 'Submit answer'}
      </button>
    </section>
  );
}
