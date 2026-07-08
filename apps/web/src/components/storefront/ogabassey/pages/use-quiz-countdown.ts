import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Submit this many ms BEFORE the server deadline so the answer beats network
 * latency. `record_quiz_answer` tolerates +1000ms, so a ~1.5s lead keeps even
 * slow connections inside the question window.
 */
export const QUIZ_AUTO_SUBMIT_LEAD_MS = 1500;
const QUIZ_COUNTDOWN_TICK_MS = 250;

interface UseQuizCountdownArgs {
  /** When false the timer is paused/stopped (e.g. while submitting). */
  active: boolean;
  /** Server-issued deadline for the current question window. */
  deadlineAt?: string | null;
  /**
   * Whether the player has an option selected. Governs the auto-submit lead: a
   * SELECTED answer submits `QUIZ_AUTO_SUBMIT_LEAD_MS` early so it beats network
   * latency, but a no-selection FORFEIT waits until the real deadline so the
   * player keeps every last second to answer. Firing the forfeit 1.5s early
   * would rob a still-deciding player of time for no benefit — the server
   * tolerates a deadline-time forfeit (records it incorrect and advances).
   */
  hasSelectedAnswer: boolean;
  /** Fired once, at the lead (selected) or the deadline (forfeit), to submit. */
  onExpire: () => void;
  /** Changing this restarts the countdown for the next question. */
  questionId: string;
  timeLimitSeconds: number;
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

function getRemainingSeconds(deadlineMs: number): number {
  return Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
}

/**
 * Per-question countdown. Remaining time is derived from a fixed deadline
 * issued by the server (NOT by decrementing a counter), so a backgrounded tab
 * shows the correct remaining time on return. Returns the whole seconds left
 * for display.
 */
export function useQuizCountdown({
  active,
  deadlineAt,
  hasSelectedAnswer,
  onExpire,
  questionId,
  timeLimitSeconds,
}: UseQuizCountdownArgs): number {
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    getRemainingSeconds(resolveDeadlineMs(deadlineAt, timeLimitSeconds))
  );
  const onExpireRef = useRef(onExpire);
  const hasSelectedAnswerRef = useRef(hasSelectedAnswer);
  const deadlineRef = useRef(0);
  // Auto-submit fires at most ONCE per question. A same-question retry toggles
  // `active` and re-runs the interval effect, so the fired state must live in a
  // ref (not an effect-local flag) — otherwise a retry past the deadline would
  // re-fire onExpire on every resume, an auto-resubmit loop. Reset only when a
  // new question arrives, mirroring the mobile timer's `firedRef`.
  const firedRef = useRef(false);

  // Refresh the callback and selection refs SYNCHRONOUSLY on commit (layout
  // effect), not in a passive effect. When a player selects an option in the
  // last ~1.5s the parent re-renders with a new `onExpire` closing over that
  // selection AND flips `hasSelectedAnswer` true; a passive effect can run
  // AFTER the next interval tick, so the tick would still call the previous
  // closure (submitting the forfeit sentinel) and read the stale
  // no-selection lead. A layout effect runs before control returns to the
  // event loop, so any subsequent tick sees the latest callback and lead.
  useLayoutEffect(() => {
    onExpireRef.current = onExpire;
    hasSelectedAnswerRef.current = hasSelectedAnswer;
  });

  // The deadline is fixed when the question is RECEIVED and must not reset when
  // the timer merely pauses/resumes (e.g. a failed same-question retry toggles
  // `active`): the server's issued_at is unchanged, so resetting here would let
  // the client auto-submit after the real server window and be scored late.
  useEffect(() => {
    deadlineRef.current = resolveDeadlineMs(deadlineAt, timeLimitSeconds);
    firedRef.current = false;
    setRemainingSeconds(getRemainingSeconds(deadlineRef.current));
  }, [deadlineAt, questionId, timeLimitSeconds]);

  useEffect(() => {
    if (!active) return;

    let intervalId = 0;

    const stop = () => window.clearInterval(intervalId);
    const tick = () => {
      const msLeft = deadlineRef.current - Date.now();
      setRemainingSeconds(Math.max(0, Math.ceil(msLeft / 1000)));
      // Submit a SELECTED answer at the lead (beat network latency); wait for
      // the real deadline before forfeiting an unanswered question so the
      // player is never cut off early.
      const leadMs = hasSelectedAnswerRef.current ? QUIZ_AUTO_SUBMIT_LEAD_MS : 0;
      if (!firedRef.current && msLeft <= leadMs) {
        firedRef.current = true;
        stop();
        onExpireRef.current();
      }
    };

    intervalId = window.setInterval(tick, QUIZ_COUNTDOWN_TICK_MS);
    tick();

    return stop;
  }, [active, deadlineAt, questionId, timeLimitSeconds]);

  return remainingSeconds;
}
