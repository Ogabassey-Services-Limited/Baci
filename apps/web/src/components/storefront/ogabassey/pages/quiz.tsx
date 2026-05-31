'use client';

import { EXAM_PASS_POINTS_COST } from '@baci/shared/constants';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useCustomerAuth } from '@/contexts/customer-auth-context';
import { apiGet, apiPost } from '@/lib/api-client';
import { asRoute } from '@/lib/routes';
import {
  type QuizAttemptResponse,
  quizAttemptResponseSchema,
  type QuizEventResponse,
  quizEventsResponseSchema,
  type QuizResultResponse,
  quizResultResponseSchema,
} from '@/schemas/quiz';

type QuizStatus = 'idle' | 'loading' | 'ready' | 'error' | 'starting' | 'question' | 'submitting' | 'result';

type OgabasseyV2QuizProps = { merchantSlug: string };

const QUIZ_INTEGRITY_TIER = 'basic';
const primaryButton =
  'h-11 rounded-lg bg-store-primary px-5 text-sm font-semibold text-store-primary-text hover:bg-store-primary/90 disabled:cursor-not-allowed disabled:bg-store-background-text/20';
const secondaryButton =
  'h-11 rounded-lg border border-store-primary px-5 text-sm font-semibold text-store-primary hover:bg-store-primary/10';
const panel = 'rounded-lg border border-store-border bg-white p-5 shadow-sm';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Quiz action failed. Please try again.';
}

function formatPointCount(points: number): string {
  return `${points} loyalty ${points === 1 ? 'point' : 'points'}`;
}

function formatDateRange(event: QuizEventResponse): string {
  const formatter = new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  if (event.endsAt && !event.startsAt) return `Ends ${formatter.format(new Date(event.endsAt))}`;
  if (event.startsAt && !event.endsAt) return `Starts ${formatter.format(new Date(event.startsAt))}`;
  if (event.startsAt && event.endsAt) return `${formatter.format(new Date(event.startsAt))} - ${formatter.format(new Date(event.endsAt))}`;
  return 'Time not set';
}

function getStartButtonText(event: QuizEventResponse, isStarting: boolean) {
  if (isStarting) return 'Starting...';
  if (event.status === 'scheduled') return 'Coming soon';
  if (event.status === 'closed') return 'Closed';
  return 'Start exam';
}

async function fetchQuizEvents(merchantSlug: string) {
  const query = new URLSearchParams({ limit: '50', merchantSlug, offset: '0' });
  const parsed = quizEventsResponseSchema.safeParse(
    await apiGet<unknown>(`/api/quiz/events?${query}`)
  );
  if (!parsed.success) throw new Error('Invalid quiz response');
  return parsed.data.events;
}

async function startQuizAttempt(eventId: string) {
  const parsed = quizAttemptResponseSchema.safeParse(
    await apiPost<unknown>('/api/quiz/attempts/start', {
      eventId,
      integrityTier: QUIZ_INTEGRITY_TIER,
    })
  );
  if (!parsed.success) throw new Error('Invalid quiz response');
  return parsed.data;
}

async function submitQuizAnswer(attemptId: string, questionId: string, answer: string) {
  const parsed = quizResultResponseSchema.safeParse(
    await apiPost<unknown>(
      `/api/quiz/attempts/${encodeURIComponent(attemptId)}/answers`,
      { answer, clientAnsweredAt: new Date().toISOString(), integrityTier: QUIZ_INTEGRITY_TIER, questionId }
    )
  );
  if (!parsed.success) throw new Error('Invalid quiz response');
  return parsed.data;
}

export function OgabasseyV2Quiz({ merchantSlug }: OgabasseyV2QuizProps) {
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useCustomerAuth();
  const [status, setStatus] = useState<QuizStatus>('idle');
  const [events, setEvents] = useState<QuizEventResponse[]>([]);
  const [attempt, setAttempt] = useState<QuizAttemptResponse | null>(null);
  const [result, setResult] = useState<QuizResultResponse | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const routePrefix = pathname?.startsWith(`/${merchantSlug}`) ? `/${merchantSlug}` : '';
  const quizPath = pathname || `${routePrefix}/quiz`;
  const loginHref = `${routePrefix}/account/login?redirect=${encodeURIComponent(quizPath)}`;

  const loadEvents = async () => {
    setError(null);
    setStatus('loading');
    try {
      setEvents(await fetchQuizEvents(merchantSlug));
      setStatus('ready');
    } catch (error) {
      setError(getErrorMessage(error));
      setStatus('error');
    }
  };

  useEffect(() => {
    if (!isLoading && isAuthenticated && status === 'idle') void loadEvents();
    // biome-ignore lint/correctness/useExhaustiveDependencies: loadEvents intentionally runs only when auth becomes ready
  }, [isAuthenticated, isLoading, merchantSlug, status]);

  const handleStart = async (event: QuizEventResponse) => {
    setError(null);
    setStatus('starting');
    try {
      const nextAttempt = await startQuizAttempt(event.id);
      setAttempt(nextAttempt);
      setResult(null);
      setSelectedAnswer(null);
      setStatus('question');
    } catch (error) {
      setError(getErrorMessage(error));
      setStatus('ready');
    }
  };

  const handleSubmit = async () => {
    if (!attempt || !selectedAnswer) return;
    setError(null);
    setStatus('submitting');
    try {
      const nextResult = await submitQuizAnswer(
        attempt.attemptId,
        attempt.question.id,
        selectedAnswer
      );
      setResult(nextResult);
      if (nextResult.status === 'in_progress' && nextResult.question) {
        setAttempt({ ...attempt, question: nextResult.question });
        setSelectedAnswer(null);
        setStatus('question');
      } else {
        setAttempt(null);
        setSelectedAnswer(null);
        setStatus('result');
      }
    } catch (error) {
      setError(getErrorMessage(error));
      setStatus('question');
    }
  };

  const progress = attempt ? Math.min(100, (attempt.question.index / attempt.question.total) * 100) : 0;

  return (
    <main className="min-h-[70vh] bg-store-background px-4 py-8 text-store-background-text sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <section className={`${panel} sm:p-6`}>
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase text-store-primary">Ogabassey rewards</p>
              <h1 className="mt-2 text-3xl font-bold tracking-normal text-store-background-text sm:text-4xl">Super Quiz</h1>
              <p className="mt-3 text-sm leading-6 text-store-background-text/70">
                Use {formatPointCount(EXAM_PASS_POINTS_COST)} as your exam pass,
                answer each timed question, and qualify for prize rewards.
              </p>
            </div>
            <div className="rounded-lg border border-store-primary/20 bg-store-primary/5 p-4">
              <p className="text-sm font-semibold">Exam pass</p>
              <p className="mt-1 text-2xl font-bold text-store-primary">{EXAM_PASS_POINTS_COST}</p>
              <p className="text-xs text-store-background-text/60">Charged when an exam starts</p>
            </div>
          </div>
        </section>

        {isLoading ? (
          <section aria-live="polite" className={panel}>Checking your quiz access…</section>
        ) : null}

        {!isLoading && !isAuthenticated ? (
          <section className={panel}>
            <h2 className="text-lg font-semibold">Sign in to play</h2>
            <p className="mt-2 text-sm leading-6 text-store-background-text/70">
              Super Quiz is available to Ogabassey customers with an active
              account and enough loyalty points for an exam pass.
            </p>
            <Link href={asRoute(loginHref)} className={`mt-4 inline-flex items-center justify-center ${primaryButton}`}>Sign in</Link>
          </section>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</p>
        ) : null}

        {isAuthenticated && (status === 'loading' || status === 'idle') ? (
          <section aria-live="polite" className={panel}>Loading quiz events…</section>
        ) : null}

        {isAuthenticated && status === 'error' ? (
          <button type="button" onClick={() => void loadEvents()} className={`w-fit ${secondaryButton}`}>Try again</button>
        ) : null}

        {isAuthenticated &&
        (status === 'ready' || status === 'starting') &&
        events.length === 0 ? (
          <section className={panel}>No quiz events available.</section>
        ) : null}

        {isAuthenticated &&
        (status === 'ready' || status === 'starting') &&
        events.length > 0 ? (
          <section aria-label="Available quiz events" className="grid gap-4 md:grid-cols-2">
            {events.map((event) => {
              const disabled = status === 'starting' || event.status !== 'open';
              return (
                <article key={event.id} className={panel}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold">{event.title}</h2>
                      <p className="mt-1 text-sm font-medium text-store-primary">{event.prizeName}</p>
                    </div>
                    <span className="rounded-full bg-store-primary/10 px-3 py-1 text-xs font-semibold text-store-primary">{event.status}</span>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-store-background-text/70">
                    {event.questionCount} questions. {formatDateRange(event)}.
                  </p>
                  <button
                    type="button"
                    disabled={disabled}
                    aria-label={`${getStartButtonText(event, status === 'starting')} for ${event.title}`}
                    onClick={() => void handleStart(event)}
                    className={`mt-5 w-full ${primaryButton}`}
                  >
                    {getStartButtonText(event, status === 'starting')}
                  </button>
                </article>
              );
            })}
          </section>
        ) : null}

        {(status === 'question' || status === 'submitting') && attempt ? (
          <section className={panel}>
            <div aria-label={`Question ${attempt.question.index} of ${attempt.question.total}`} aria-valuemax={attempt.question.total} aria-valuemin={1} aria-valuenow={attempt.question.index} role="progressbar" className="h-2 overflow-hidden rounded-full bg-store-secondary">
              <div className="h-full rounded-full bg-store-primary" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-4 text-sm font-semibold text-store-primary">{attempt.question.timeLimitSeconds}s per question</p>
            <p className="mt-2 text-xs text-store-background-text/60">
              {formatPointCount(attempt.examPassPointsSpent)} exam pass used.{' '}
              {formatPointCount(attempt.remainingLoyaltyPoints)} left.
            </p>
            <h2 className="mt-5 text-xl font-bold">{attempt.question.prompt}</h2>
            <div className="mt-5 grid gap-3">
              {attempt.question.options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  disabled={status === 'submitting'}
                  aria-pressed={selectedAnswer === option.id}
                  onClick={() => setSelectedAnswer(option.id)}
                  className={
                    selectedAnswer === option.id
                      ? 'rounded-lg border border-store-primary bg-store-primary/10 px-4 py-3 text-left text-sm font-semibold text-store-primary'
                      : 'rounded-lg border border-store-border bg-white px-4 py-3 text-left text-sm font-semibold hover:border-store-primary/50'
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button type="button" disabled={!selectedAnswer || status === 'submitting'} onClick={() => void handleSubmit()} className={`mt-5 w-full ${primaryButton}`}>
              {status === 'submitting' ? 'Submitting...' : 'Submit answer'}
            </button>
          </section>
        ) : null}

        {status === 'result' && result ? (
          <section role="status" className={panel}>
            <h2 className="text-lg font-semibold">Result</h2>
            <p className="mt-2 text-3xl font-bold text-store-primary">{result.correctAnswers} of {result.totalQuestions}</p>
            <p className="mt-2 text-sm text-store-background-text/70">
              {result.prizeEligible ? 'Prize entry recorded.' : 'Practice result recorded.'}
            </p>
            {result.prizeClaim ? (
              <Link href={asRoute(result.prizeClaim.cartPath)} className={`mt-5 inline-flex items-center justify-center ${primaryButton}`}>
                Add gift to cart
              </Link>
            ) : null}
            <button type="button" onClick={() => void loadEvents()} className={`${result.prizeClaim ? 'ml-0 mt-3 block' : 'mt-5'} ${secondaryButton}`}>Back to quizzes</button>
          </section>
        ) : null}
      </div>
    </main>
  );
}
