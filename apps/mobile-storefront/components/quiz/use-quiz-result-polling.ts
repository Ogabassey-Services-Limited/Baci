import { useEffect } from 'react';
import { AppState } from 'react-native';
import { fetchQuizResult } from '@/services/quiz-results';
import type { QuizV2Result } from '@/services/quiz-types';

export const QUIZ_RESULT_POLL_INTERVAL_MS = 1_000;

export function useQuizResultPolling({
  attemptId,
  enabled,
  expectedUserId,
  onResult,
}: {
  attemptId: string | null;
  enabled: boolean;
  expectedUserId: string | null;
  onResult: (result: QuizV2Result) => void;
}) {
  useEffect(() => {
    if (!enabled || !attemptId || !expectedUserId) return;

    let cancelled = false;
    let inFlight = false;
    let appIsActive = AppState.currentState === 'active';
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      if (cancelled || !appIsActive) return;
      timeoutId = setTimeout(poll, QUIZ_RESULT_POLL_INTERVAL_MS);
    };
    const poll = async () => {
      if (cancelled || !appIsActive || inFlight) return;
      inFlight = true;
      try {
        const result = await fetchQuizResult({ attemptId, expectedUserId });
        if (cancelled) return;
        onResult(result);
        if (result.availability === 'pending') schedule();
      } catch {
        schedule();
      } finally {
        inFlight = false;
      }
    };

    void poll();
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = undefined;
      appIsActive = nextState === 'active';
      if (!appIsActive) return;
      void poll();
    });

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      subscription.remove();
    };
  }, [attemptId, enabled, expectedUserId, onResult]);
}
