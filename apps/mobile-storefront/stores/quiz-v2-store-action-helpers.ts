import type {
  QuizActiveAttemptResponse,
  QuizV2Attempt,
  QuizV2Result,
} from '@/services/quiz-types';
import type {
  QuizTerminalContext,
  QuizV2StoreState,
  V2StartContext,
} from './quiz-recovery-envelope';
import {
  clearQuizRecoveryEnvelope,
  createQuizRecoveryEnvelope,
  saveQuizRecoveryEnvelope,
} from './quiz-recovery-envelope';

export interface QuizV2StoreAccess {
  get: () => QuizV2StoreState;
  getGeneration: () => number;
  getMessage: (error: unknown) => string;
  set: (state: Partial<QuizV2StoreState>) => void;
}

export async function clearRecoveredQuizAttempt(
  access: QuizV2StoreAccess,
  eventId: string
): Promise<void> {
  const userId = access.get().recoveryUserId;
  if (userId) await clearQuizRecoveryEnvelope(userId, eventId);
}

export async function clearTerminalRecovery(
  access: QuizV2StoreAccess,
  eventId: string,
  shouldClear: boolean
): Promise<void> {
  if (shouldClear) await clearRecoveredQuizAttempt(access, eventId);
}

export function createQuizTerminalContext(
  attemptId: string,
  eventId: string,
  eventEndsAt?: string | null,
  serverNow?: string | null
): QuizTerminalContext {
  return {
    attemptId,
    eventId,
    eventEndsAt,
    serverNow,
    contractVersion: 2,
  };
}

export function isQuizOpenAtServerTime(
  response: QuizActiveAttemptResponse
): boolean {
  if (!response.serverNow || !response.eventEndsAt) return false;
  return Date.parse(response.serverNow) < Date.parse(response.eventEndsAt);
}

export function createQuizAttemptPersistence(access: QuizV2StoreAccess) {
  return async (attempt: QuizV2Attempt, lockedOptionId: string | null) => {
    const state = access.get();
    if (!state.recoveryUserId || !state.startRequestId) return;
    await saveQuizRecoveryEnvelope(
      createQuizRecoveryEnvelope({
        attemptId: attempt.attemptId,
        currentQuestionId: attempt.question?.id ?? null,
        eventId: attempt.eventId,
        generation: access.getGeneration(),
        pendingLockedOptionId: lockedOptionId,
        startRequestId: state.startRequestId,
        userId: state.recoveryUserId,
      })
    );
  };
}

export function saveQuizStartRequest(
  context: V2StartContext,
  generation: number,
  startRequestId: string
): Promise<void> {
  return saveQuizRecoveryEnvelope(
    createQuizRecoveryEnvelope({
      attemptId: null,
      currentQuestionId: null,
      eventId: context.eventId,
      generation,
      pendingLockedOptionId: null,
      startRequestId,
      userId: context.userId,
    })
  );
}

export function resultLifecycle(result: QuizV2Result) {
  if (result.availability === 'pending') return 'pending_results' as const;
  if (
    result.availability === 'unavailable' &&
    result.reason === 'event_cancelled'
  )
    return 'event_cancelled' as const;
  return 'final' as const;
}
