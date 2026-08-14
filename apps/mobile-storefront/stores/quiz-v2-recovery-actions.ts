import type {
  QuizActiveAttemptResponse,
  QuizV2Attempt,
} from '@/services/quiz-types';
import {
  clearRecoveredQuizAttempt,
  createQuizTerminalContext,
  isQuizOpenAtServerTime,
  type QuizV2StoreAccess,
} from './quiz-v2-store-action-helpers';

export function createQuizV2RecoveryResponseApplier({
  access,
  apply,
}: {
  access: QuizV2StoreAccess;
  apply: (attempt: QuizV2Attempt) => Promise<void>;
}) {
  return async (
    response: QuizActiveAttemptResponse,
    fallback: QuizV2Attempt
  ) => {
    if (
      response.availability === 'active' &&
      response.attempt &&
      isQuizOpenAtServerTime(response)
    ) {
      await apply(response.attempt);
      return;
    }
    if (
      response.availability === 'none' ||
      response.availability === 'unavailable'
    ) {
      access.set({
        status: 'question',
        v2Attempt: fallback,
        expiryRetryable: true,
        error: null,
      });
      return;
    }
    const expiredActive =
      response.availability === 'active' && response.attempt;
    const terminal =
      expiredActive ||
      response.availability === 'pending_results' ||
      response.availability === 'cancelled';
    if (!terminal) return;
    access.set({
      status: 'result',
      v2Attempt: null,
      v2LifecycleStatus:
        response.availability === 'cancelled'
          ? 'event_cancelled'
          : 'pending_results',
      terminalContext: createQuizTerminalContext(
        fallback.attemptId,
        fallback.eventId,
        response.eventEndsAt ?? fallback.eventEndsAt,
        response.serverNow ?? fallback.serverNow
      ),
      lockedOptionId: null,
      expiryRetryable: false,
      error: null,
    });
    if (response.availability === 'cancelled') {
      await clearRecoveredQuizAttempt(access, fallback.eventId);
    }
  };
}
