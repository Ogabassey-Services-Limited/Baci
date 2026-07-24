'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useCustomerAuth } from '@/contexts/customer-auth-context';
import { asRoute } from '@/lib/routes';
import type {
  QuizAttemptResponse,
  QuizEventResponse,
  QuizResultResponse,
} from '@/schemas/quiz';
import { formatQuizDateRange } from './format-quiz-date-range';
import { getQuizErrorMessage } from './get-quiz-error-message';
import { QuizAgeGateModal } from './quiz-age-gate-modal';
import { getQuizStartButtonText } from './get-quiz-start-button-text';
import {
  loadQuizEvents,
  QUIZ_FORFEIT_ANSWER,
  type QuizStatus,
  startQuizAttempt,
  submitQuizAnswer,
} from './quiz-page-data';
import { QuizQuestionPanel } from './quiz-question-panel';
import { QuizResultPanel } from './quiz-result-panel';
import {
  quizPanel as panel,
  quizPrimaryButton as primaryButton,
  quizSecondaryButton as secondaryButton,
} from './quiz-styles';

type OgabasseyV2QuizProps = { merchantSlug: string };

export function OgabasseyV2Quiz({ merchantSlug }: OgabasseyV2QuizProps) {
  const pathname = usePathname();
  const { customer, isAuthenticated, isLoading, updateCustomer } =
    useCustomerAuth();
  const [status, setStatus] = useState<QuizStatus>('idle');
  const [events, setEvents] = useState<QuizEventResponse[]>([]);
  const [attempt, setAttempt] = useState<QuizAttemptResponse | null>(null);
  const [result, setResult] = useState<QuizResultResponse | null>(null);
  // Captured at start so the result view can load this event's leaderboard —
  // `attempt` is cleared when the attempt completes.
  const [playedEventId, setPlayedEventId] = useState<string | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Super Quiz is 18+. When the customer has no date of birth on file, the
  // start is deferred behind this gate until they provide one.
  const [ageGateEvent, setAgeGateEvent] = useState<QuizEventResponse | null>(
    null
  );
  const [ageGateSubmitting, setAgeGateSubmitting] = useState(false);
  const [ageGateError, setAgeGateError] = useState<string | null>(null);
  // Synchronous in-flight guards (FIX D): async state (`status`) updates on the
  // next render, so a fast physical double-tap can fire two requests before the
  // button disables. The server does NOT dedupe start — each call burns one of
  // the player's limited attempts (QZ030 cap) — so guard synchronously.
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

  const runStart = async (event: QuizEventResponse) => {
    if (startInFlightRef.current) return;
    startInFlightRef.current = true;
    setError(null);
    setStatus('starting');
    try {
      const nextAttempt = await startQuizAttempt(event.id);
      setAttempt(nextAttempt);
      setPlayedEventId(event.id);
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

  const handleStart = (event: QuizEventResponse) => {
    // The server age gate (production) needs a date of birth on the customer
    // profile; collect it once here before starting, otherwise start straight.
    if (customer && !customer.date_of_birth) {
      setAgeGateError(null);
      setAgeGateEvent(event);
      return;
    }
    void runStart(event);
  };

  const handleAgeGateSubmit = async (dateOfBirth: string) => {
    const event = ageGateEvent;
    if (!event) return;
    setAgeGateSubmitting(true);
    setAgeGateError(null);
    const saved = await updateCustomer({ date_of_birth: dateOfBirth });
    setAgeGateSubmitting(false);
    if (!saved.success) {
      setAgeGateError(saved.error ?? 'Could not save your date of birth.');
      return;
    }
    setAgeGateEvent(null);
    void runStart(event);
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
      // Keep a failed timeout submission retryable. Without the sentinel in
      // state, the question returns with no selected answer and the player
      // has no way to retry the request after the timer has already fired.
      if (answer === QUIZ_FORFEIT_ANSWER) {
        setSelectedAnswer(QUIZ_FORFEIT_ANSWER);
      }
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
                Free to enter — answer each timed question and qualify for prize
                rewards. No purchase necessary.
              </p>
            </div>
            <div className="rounded-lg border border-store-primary/20 bg-store-primary/5 p-4">
              <p className="text-sm font-semibold">Entry</p>
              <p className="mt-1 text-2xl font-bold text-store-primary">Free</p>
              <p className="text-xs text-store-background-text/60">No loyalty points required</p>
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
              Super Quiz is free to play for anyone with an Ogabassey account.
              Creating one is free — no purchase necessary.
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
          <QuizResultPanel
            eventId={playedEventId}
            onBackToQuizzes={() => void loadEvents()}
            result={result}
          />
        ) : null}
      </div>

      <QuizAgeGateModal
        onCancel={() => setAgeGateEvent(null)}
        onSubmit={(dateOfBirth) => void handleAgeGateSubmit(dateOfBirth)}
        open={ageGateEvent !== null}
        serverError={ageGateError}
        submitting={ageGateSubmitting}
      />
    </main>
  );
}
