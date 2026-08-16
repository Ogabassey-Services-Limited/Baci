import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { fetchQuizResult } from '@/services/quiz-results';
import type { QuizV2Result } from '@/services/quiz-types';

export const QUIZ_RESULT_POLL_INTERVAL_MS = 5_000;
export const QUIZ_RESULT_POLL_MAX_INTERVAL_MS = 30_000;

function getPendingPollDelayMs(
  availableAt: string | null,
  nowMs = Date.now()
): number {
  const availableAtMs = availableAt ? Date.parse(availableAt) : Number.NaN;
  if (Number.isFinite(availableAtMs) && availableAtMs > nowMs) {
    return Math.min(availableAtMs - nowMs, QUIZ_RESULT_POLL_MAX_INTERVAL_MS);
  }
  return QUIZ_RESULT_POLL_INTERVAL_MS;
}

function getFailedPollDelayMs(consecutiveFailures: number): number {
  const exponent = Math.max(0, consecutiveFailures - 1);
  return Math.min(
    QUIZ_RESULT_POLL_INTERVAL_MS * 2 ** exponent,
    QUIZ_RESULT_POLL_MAX_INTERVAL_MS
  );
}

export function useQuizResultPolling({
  attemptId,
  enabled,
  expectedUserId,
  getCurrentUserId,
  onResult,
}: {
  attemptId: string | null;
  enabled: boolean;
  expectedUserId: string | null;
  getCurrentUserId?: () => string | null;
  onResult: (result: QuizV2Result) => void;
}) {
  const currentUserIdRef = useRef(getCurrentUserId);
  currentUserIdRef.current = getCurrentUserId;

  useEffect(() => {
    if (!enabled || !attemptId || !expectedUserId) return;

    let cancelled = false;
    let inFlight = false;
    let resumeAfterFlight = false;
    let consecutiveFailures = 0;
    let appIsActive =
      AppState.currentState !== 'background' &&
      AppState.currentState !== 'inactive';
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const schedule = (delayMs = QUIZ_RESULT_POLL_INTERVAL_MS) => {
      if (cancelled || !appIsActive) return;
      timeoutId = setTimeout(poll, delayMs);
    };
    const poll = async () => {
      if (cancelled || !appIsActive || inFlight) return;
      inFlight = true;
      let shouldContinue = false;
      let nextDelayMs = QUIZ_RESULT_POLL_INTERVAL_MS;
      try {
        const result = await fetchQuizResult({ attemptId, expectedUserId });
        consecutiveFailures = 0;
        if (result.availability === 'pending') {
          shouldContinue = true;
          nextDelayMs = getPendingPollDelayMs(result.availableAt);
        }
        if (cancelled) return;
        if (
          currentUserIdRef.current &&
          currentUserIdRef.current() !== expectedUserId
        ) {
          cancelled = true;
          return;
        }
        onResult(result);
      } catch {
        shouldContinue = true;
        consecutiveFailures += 1;
        nextDelayMs = getFailedPollDelayMs(consecutiveFailures);
      } finally {
        inFlight = false;
        if (cancelled || !shouldContinue) {
          resumeAfterFlight = false;
        } else if (resumeAfterFlight && appIsActive) {
          resumeAfterFlight = false;
          void poll();
        } else {
          schedule(nextDelayMs);
        }
      }
    };

    void poll();
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = undefined;
      appIsActive = nextState === 'active';
      if (!appIsActive) return;
      if (inFlight) {
        resumeAfterFlight = true;
        return;
      }
      resumeAfterFlight = false;
      void poll();
    });

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      subscription.remove();
    };
  }, [attemptId, enabled, expectedUserId, onResult]);
}
