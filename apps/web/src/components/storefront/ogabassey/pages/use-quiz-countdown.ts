import { useEffect, useRef, useState } from 'react';

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
  /** Fired once, ~lead-ms before expiry, to auto-submit the current answer. */
  onExpire: () => void;
  /** Changing this restarts the countdown for the next question. */
  questionId: string;
  timeLimitSeconds: number;
}

/**
 * Per-question countdown. Remaining time is derived from a fixed deadline
 * captured when the question is received (NOT by decrementing a counter), so a
 * backgrounded tab shows the correct remaining time on return. Returns the
 * whole seconds left for display.
 */
export function useQuizCountdown({
  active,
  onExpire,
  questionId,
  timeLimitSeconds,
}: UseQuizCountdownArgs): number {
  const [remainingSeconds, setRemainingSeconds] = useState(timeLimitSeconds);
  const onExpireRef = useRef(onExpire);
  const deadlineRef = useRef(0);

  useEffect(() => {
    onExpireRef.current = onExpire;
  });

  // The deadline is fixed when the question is RECEIVED and must not reset when
  // the timer merely pauses/resumes (e.g. a failed same-question retry toggles
  // `active`): the server's issued_at is unchanged, so resetting here would let
  // the client auto-submit after the real server window and be scored late.
  useEffect(() => {
    deadlineRef.current = Date.now() + timeLimitSeconds * 1000;
    setRemainingSeconds(timeLimitSeconds);
  }, [questionId, timeLimitSeconds]);

  useEffect(() => {
    if (!active) return;

    let expired = false;
    let intervalId = 0;

    const stop = () => window.clearInterval(intervalId);
    const tick = () => {
      const msLeft = deadlineRef.current - Date.now();
      setRemainingSeconds(Math.max(0, Math.ceil(msLeft / 1000)));
      if (!expired && msLeft <= QUIZ_AUTO_SUBMIT_LEAD_MS) {
        expired = true;
        stop();
        onExpireRef.current();
      }
    };

    intervalId = window.setInterval(tick, QUIZ_COUNTDOWN_TICK_MS);
    tick();

    return stop;
  }, [active, questionId, timeLimitSeconds]);

  return remainingSeconds;
}
