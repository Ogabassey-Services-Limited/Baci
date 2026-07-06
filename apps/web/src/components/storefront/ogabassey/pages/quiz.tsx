'use client';

import { EXAM_PASS_POINTS_COST } from '@baci/shared/constants';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
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
import { formatQuizDateRange } from './format-quiz-date-range';
import { formatQuizPointCount } from './format-quiz-point-count';
import { getQuizErrorMessage } from './get-quiz-error-message';
import { getQuizStartButtonText } from './get-quiz-start-button-text';
import { QuizQuestionPanel } from './quiz-question-panel';
import {
  quizPanel as panel,
  quizPrimaryButton as primaryButton,
  quizSecondaryButton as secondaryButton,
} from './quiz-styles';

type QuizStatus = 'idle' | 'loading' | 'ready' | 'error' | 'starting' | 'question' | 'submitting' | 'result';

type OgabasseyV2QuizProps = { merchantSlug: string };

const QUIZ_INTEGRITY_TIER = 'basic';
// Non-empty sentinel so an auto-submitted forfeit still satisfies the answer
// schema (min length 1). The server treats any non-matching answer as
// incorrect and advances the attempt, so a timed-out player is scored wrong
// rather than left stalled. It is intentionally longer than the 20-char option
// id cap (generatedQuizOptionSchema) so it can never equal a real option id and
// be scored correct by accident.
const QUIZ_FORFEIT_ANSWER = '__baci_quiz_timeout_forfeit_no_answer__';
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

interface QuizListSetters {
  setError: (error: string | null) => void;
  setEvents: (events: QuizEventResponse[]) => void;
  setStatus: (status: QuizStatus) => void;
}

// Module-scope helper so the status/error bookkeeping is not a synchronous
// setState inside the component's effect body.
async function loadQuizEvents(
  merchantSlug: string,
  { setError, setEvents, setStatus }: QuizListSetters,
) {
  setError(null);
  setStatus('loading');
  try {
    setEvents(await fetchQuizEvents(merchantSlug));
    setStatus('ready');
  } catch (error) {
    setError(getQuizErrorMessage(error));
    setStatus('error');
  }
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
  // Synchronous in-flight guards (FIX D): async state (`status`) updates on the
  // next render, so a fast physical double-tap can fire two requests before the
  // button disables. The server does NOT dedupe start (each debits a point), so
  // guard synchronously.
  const startInFlightRef = useRef(false);
  const submitInFlightRef = useRef(false);
  const routePrefix = pathname?.startsWith(`/${merchantSlug}`) ? `/${merchantSlug}` : '';
  const quizPath = pathname || `${routePrefix}/quiz`;
  const loginHref = `${routePrefix}/account/login?redirect=${encodeURIComponent(quizPath)}`;

  const loadEvents = () =>
    loadQuizEvents(merchantSlug, { setError, setEvents, setStatus });

  useEffect(() => {
    if (!isLoading && isAuthenticated && status === 'idle') void loadEvents();
    // biome-ignore lint/correctness/useExhaustiveDependencies: loadEvents intentionally runs only when auth becomes ready
  }, [isAuthenticated, isLoading, merchantSlug, status]);

  const handleStart = async (event: QuizEventResponse) => {
    if (startInFlightRef.current) return;
    startInFlightRef.current = true;
    setError(null);
    setStatus('starting');
    try {
      const nextAttempt = await startQuizAttempt(event.id);
      setAttempt(nextAttempt);
      setResult(null);
      setSelectedAnswer(null);
      setStatus('question');
    } catch (error) {
      setError(getQuizErrorMessage(error));
      setStatus('ready');
    } finally {
      startInFlightRef.current = false;
    }
  };

  const submitAnswer = async (answer: string) => {
    if (!attempt || submitInFlightRef.current) return;
    submitInFlightRef.current = true;
    setError(null);
    setStatus('submitting');
    try {
      const nextResult = await submitQuizAnswer(
        attempt.attemptId,
        attempt.question.id,
        answer
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
      setError(getQuizErrorMessage(error));
      setStatus('question');
    } finally {
      submitInFlightRef.current = false;
    }
  };

  const handleSubmit = () => {
    if (!selectedAnswer) return;
    void submitAnswer(selectedAnswer);
  };

  // FIX A: the countdown fires this at expiry. Submit the selected option, or a
  // forfeit sentinel if none is picked, so the attempt always advances.
  const handleAutoSubmit = () => {
    if (!attempt || status !== 'question') return;
    void submitAnswer(selectedAnswer ?? QUIZ_FORFEIT_ANSWER);
  };

  return (
    <main className="min-h-[70vh] bg-store-background px-4 py-8 text-store-background-text sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <section className={`${panel} sm:p-6`}>
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase text-store-primary">Ogabassey rewards</p>
              <h1 className="mt-2 text-3xl font-bold tracking-normal text-store-background-text sm:text-4xl">Super Quiz</h1>
              <p className="mt-3 text-sm leading-6 text-store-background-text/70">
                Use {formatQuizPointCount(EXAM_PASS_POINTS_COST)} as your exam pass,
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
                    {event.questionCount} questions. {formatQuizDateRange(event)}.
                  </p>
                  <button
                    type="button"
                    disabled={disabled}
                    aria-label={`${getQuizStartButtonText(event, status === 'starting')} for ${event.title}`}
                    onClick={() => void handleStart(event)}
                    className={`mt-5 w-full ${primaryButton}`}
                  >
                    {getQuizStartButtonText(event, status === 'starting')}
                  </button>
                </article>
              );
            })}
          </section>
        ) : null}

        {(status === 'question' || status === 'submitting') && attempt ? (
          <QuizQuestionPanel
            key={attempt.question.id}
            attempt={attempt}
            isSubmitting={status === 'submitting'}
            onAutoSubmit={handleAutoSubmit}
            onSelect={setSelectedAnswer}
            onSubmit={handleSubmit}
            selectedAnswer={selectedAnswer}
          />
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
