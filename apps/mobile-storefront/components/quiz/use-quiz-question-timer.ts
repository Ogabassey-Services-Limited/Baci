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
  /** True only while the player can still answer (status === 'question'). */
  isActive: boolean;
  /** Fired once per question when the window is about to close. */
  onExpire: () => void;
}

interface QuizQuestionTimerState {
  remainingSeconds: number;
  isExpiring: boolean;
}

/**
 * Drives a per-question countdown from a timestamp captured when the question
 * is received, so backgrounding the app shows the correct remaining time on
 * return (recomputed on foreground via AppState) and the window auto-submits
 * once — cleaning up its interval on unmount and on every question change.
 */
export function useQuizQuestionTimer({
  questionId,
  timeLimitSeconds,
  isActive,
  onExpire,
}: UseQuizQuestionTimerParams): QuizQuestionTimerState {
  const startedAtRef = useRef(Date.now());
  const firedRef = useRef(false);
  const [remainingMs, setRemainingMs] = useState(timeLimitSeconds * 1000);

  // Latest onExpire without retriggering the interval effect on every render.
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  // Reset the countdown the moment a new question arrives (render-time compare
  // avoids a stale first frame from an effect).
  const [trackedQuestionId, setTrackedQuestionId] = useState(questionId);
  if (questionId !== trackedQuestionId) {
    setTrackedQuestionId(questionId);
    startedAtRef.current = Date.now();
    firedRef.current = false;
    setRemainingMs(timeLimitSeconds * 1000);
  }

  useEffect(() => {
    if (!isActive || questionId === null) return;

    const evaluate = () => {
      const totalMs = timeLimitSeconds * 1000;
      const elapsed = Date.now() - startedAtRef.current;
      const remaining = Math.max(0, totalMs - elapsed);
      setRemainingMs(remaining);

      if (!firedRef.current && remaining <= QUIZ_AUTO_SUBMIT_LEAD_MS) {
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
  }, [isActive, questionId, timeLimitSeconds]);

  return {
    remainingSeconds: Math.ceil(remainingMs / 1000),
    isExpiring: remainingMs <= QUIZ_AUTO_SUBMIT_LEAD_MS,
  };
}
