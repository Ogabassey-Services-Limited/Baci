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
  /** Universal event end; the question can never outlive this instant. */
  eventEndsAt?: string | null;
  /** Difference between the server clock and the local device clock. */
  serverClockOffsetMs?: number;
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

type ResolvedQuestionDeadline = {
  eventEndMs: number | null;
  fallbackDeadlineMs: number | null;
  serverDeadlineMs: number | null;
};

function resolveDeadline(
  deadlineAt: string | null | undefined,
  eventEndsAt: string | null | undefined,
  timeLimitSeconds: number
): ResolvedQuestionDeadline {
  const parsedDeadline = deadlineAt ? Date.parse(deadlineAt) : Number.NaN;
  const parsedEventEnd = eventEndsAt ? Date.parse(eventEndsAt) : Number.NaN;
  return {
    eventEndMs: Number.isFinite(parsedEventEnd) ? parsedEventEnd : null,
    // A fallback is generated on the device, so it must remain in the device
    // clock domain. Applying a later server-clock correction to it would grant
    // or remove time that the server never issued.
    fallbackDeadlineMs: Number.isFinite(parsedDeadline)
      ? null
      : Date.now() + timeLimitSeconds * 1000,
    serverDeadlineMs: Number.isFinite(parsedDeadline) ? parsedDeadline : null,
  };
}

function getRemainingMs(
  deadline: ResolvedQuestionDeadline,
  serverClockOffsetMs: number
): number {
  const deviceNow = Date.now();
  const serverNow = deviceNow + serverClockOffsetMs;
  const candidates = [
    deadline.fallbackDeadlineMs === null
      ? null
      : deadline.fallbackDeadlineMs - deviceNow,
    deadline.serverDeadlineMs === null
      ? null
      : deadline.serverDeadlineMs - serverNow,
    deadline.eventEndMs === null ? null : deadline.eventEndMs - serverNow,
  ].filter((candidate): candidate is number => candidate !== null);
  return Math.max(0, Math.min(...candidates));
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
  eventEndsAt,
  serverClockOffsetMs = 0,
  isActive,
  hasSelection,
  onExpire,
}: UseQuizQuestionTimerParams): QuizQuestionTimerState {
  const deadlineRef = useRef(
    resolveDeadline(deadlineAt, eventEndsAt, timeLimitSeconds)
  );
  const firedRef = useRef(false);
  const [remainingMs, setRemainingMs] = useState(() =>
    getRemainingMs(deadlineRef.current, serverClockOffsetMs)
  );

  // Latest onExpire/hasSelection without retriggering the interval effect on
  // every render — the tick reads the live values through refs.
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;
  const hasSelectionRef = useRef(hasSelection);
  hasSelectionRef.current = hasSelection;

  // Reset the countdown the moment a new question arrives (render-time compare
  // avoids a stale first frame from an effect).
  // Clock calibration can change while the same question remains mounted. It
  // changes how remaining time is measured, but it must not make an already
  // expired question eligible to fire again.
  const questionTimerKey = `${questionId ?? 'none'}:${deadlineAt ?? ''}:${eventEndsAt ?? ''}:${timeLimitSeconds}`;
  const [trackedQuestionTimerKey, setTrackedQuestionTimerKey] =
    useState(questionTimerKey);
  if (questionTimerKey !== trackedQuestionTimerKey) {
    setTrackedQuestionTimerKey(questionTimerKey);
    deadlineRef.current = resolveDeadline(
      deadlineAt,
      eventEndsAt,
      timeLimitSeconds
    );
    firedRef.current = false;
    setRemainingMs(getRemainingMs(deadlineRef.current, serverClockOffsetMs));
  }

  useEffect(() => {
    if (!isActive || questionId === null) return;

    const evaluate = () => {
      const remaining = getRemainingMs(
        deadlineRef.current,
        serverClockOffsetMs
      );
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
  }, [isActive, questionId, serverClockOffsetMs]);

  return {
    remainingSeconds: Math.ceil(remainingMs / 1000),
    isExpiring: remainingMs <= QUIZ_AUTO_SUBMIT_LEAD_MS,
  };
}
