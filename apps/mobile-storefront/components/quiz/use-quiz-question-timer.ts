import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

/**
 * Auto-submit slightly before the true deadline to beat network latency. The
 * server tolerates roughly +1000ms past the window, so submitting ~1.5s early
 * keeps a normal-latency answer inside the accepted window.
 */
export const QUIZ_AUTO_SUBMIT_LEAD_MS = 1500;

const TICK_INTERVAL_MS = 250;

interface UseQuizQuestionTimerParams {
  /** Stable id of the current question; `null` when no question is active. */
  questionId: string | null;
  timeLimitSeconds: number;
  /** Server-issued deadline for the current question window. */
  deadlineAt?: string | null;
  /** True only while the player can still answer (status === 'question'). */
  isActive: boolean;
  /**
   * Whether the player has an option selected. A selected answer auto-submits
   * QUIZ_AUTO_SUBMIT_LEAD_MS early to beat network latency; with NO selection
   * there is nothing to protect from latency, so the forfeit waits until the
   * real deadline — firing early would steal the player's final seconds.
   */
  hasSelection: boolean;
  /** Fired once per question when the window is about to close. */
  onExpire: () => void;
}

interface QuizQuestionTimerState {
  remainingSeconds: number;
  isExpiring: boolean;
}

function resolveDeadlineMs(
  deadlineAt: string | null | undefined,
  timeLimitSeconds: number
): number {
  const parsedDeadline = deadlineAt ? Date.parse(deadlineAt) : Number.NaN;
  return Number.isFinite(parsedDeadline)
    ? parsedDeadline
    : Date.now() + timeLimitSeconds * 1000;
}

function getRemainingMs(deadlineMs: number): number {
  return Math.max(0, deadlineMs - Date.now());
}

/**
 * Drives a per-question countdown from the server-issued deadline, so
 * backgrounding the app shows the correct remaining time on return (recomputed
 * on foreground via AppState) and the window auto-submits once — cleaning up its
 * interval on unmount and on every question change.
 */
export function useQuizQuestionTimer({
  questionId,
  timeLimitSeconds,
  deadlineAt,
  isActive,
  hasSelection,
  onExpire,
}: UseQuizQuestionTimerParams): QuizQuestionTimerState {
  const deadlineRef = useRef(resolveDeadlineMs(deadlineAt, timeLimitSeconds));
  const firedRef = useRef(false);
  const [remainingMs, setRemainingMs] = useState(() =>
    getRemainingMs(deadlineRef.current)
  );

  // Latest onExpire/hasSelection without retriggering the interval effect on
  // every render — the tick reads the live values through refs.
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;
  const hasSelectionRef = useRef(hasSelection);
  hasSelectionRef.current = hasSelection;

  // Reset the countdown the moment a new question arrives (render-time compare
  // avoids a stale first frame from an effect).
  const questionTimerKey = `${questionId ?? 'none'}:${deadlineAt ?? ''}:${timeLimitSeconds}`;
  const [trackedQuestionTimerKey, setTrackedQuestionTimerKey] =
    useState(questionTimerKey);
  if (questionTimerKey !== trackedQuestionTimerKey) {
    setTrackedQuestionTimerKey(questionTimerKey);
    deadlineRef.current = resolveDeadlineMs(deadlineAt, timeLimitSeconds);
    firedRef.current = false;
    setRemainingMs(getRemainingMs(deadlineRef.current));
  }

  useEffect(() => {
    if (!isActive || questionId === null) return;

    const evaluate = () => {
      const remaining = getRemainingMs(deadlineRef.current);
      setRemainingMs(remaining);

      // Selected answer: fire early (lead) to beat network latency. No
      // selection: nothing to protect — wait for the true deadline so the
      // player keeps their final seconds (the server tolerates ~+1000ms and
      // records a late/blank answer as incorrect-and-advance, so a
      // deadline-time forfeit is safe).
      const fireAtMs = hasSelectionRef.current ? QUIZ_AUTO_SUBMIT_LEAD_MS : 0;
      if (!firedRef.current && remaining <= fireAtMs) {
        firedRef.current = true;
        onExpireRef.current();
      }
    };

    evaluate();
    const intervalId = setInterval(evaluate, TICK_INTERVAL_MS);
    // Timers can be throttled while backgrounded; recompute immediately on
    // foreground so a window that lapsed off-screen auto-submits right away.
    const appStateSubscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') evaluate();
    });

    return () => {
      clearInterval(intervalId);
      appStateSubscription?.remove?.();
    };
  }, [deadlineAt, isActive, questionId, timeLimitSeconds]);

  return {
    remainingSeconds: Math.ceil(remainingMs / 1000),
    isExpiring: remainingMs <= QUIZ_AUTO_SUBMIT_LEAD_MS,
  };
}
