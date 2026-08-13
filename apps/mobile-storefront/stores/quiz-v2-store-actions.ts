import type {
  QuizActiveAttemptResponse,
  QuizV2Attempt,
} from '@/services/quiz-types';
import {
  clearQuizRecoveryEnvelope,
  createQuizRecoveryEnvelope,
  initialQuizV2State,
  loadQuizRecoveryEnvelope,
  type QuizV2StoreActions,
  type QuizV2StoreState,
  saveQuizRecoveryEnvelope,
  type V2StartContext,
} from './quiz-recovery-envelope';
export const QUIZ_RECONCILIATION_INTERVAL_MS = 15_000;
type StoreAccess = {
  get: () => QuizV2StoreState;
  getGeneration: () => number;
  getMessage: (error: unknown) => string;
  set: (state: Partial<QuizV2StoreState>) => void;
};
const terminalContextFor = (
  attemptId: string,
  eventId: string,
  eventEndsAt?: string | null,
  serverNow?: string | null
) => ({
  attemptId,
  eventId,
  eventEndsAt,
  serverNow,
  contractVersion: 2 as const,
});
function isOpenAtServerTime(response: QuizActiveAttemptResponse): boolean {
  const serverNow = response.serverNow;
  const eventEndsAt = response.eventEndsAt;
  if (!serverNow || !eventEndsAt) return false;
  return Date.parse(serverNow) < Date.parse(eventEndsAt);
}
export function createQuizV2StoreActions({
  get,
  getGeneration,
  getMessage,
  set,
}: StoreAccess): QuizV2StoreActions {
  let lastReconciledAt = 0;
  let reconciliationInFlight = false;
  let expiryInFlight = false;
  let retryInFlight = false;
  let lifecycleEpoch = 0;
  const persist = async (attempt: QuizV2Attempt, locked: string | null) => {
    const state = get();
    if (!state.recoveryUserId || !state.startRequestId) return;
    await saveQuizRecoveryEnvelope(
      createQuizRecoveryEnvelope({
        attemptId: attempt.attemptId,
        currentQuestionId: attempt.question?.id ?? null,
        eventId: attempt.eventId,
        generation: getGeneration(),
        pendingLockedOptionId: locked,
        startRequestId: state.startRequestId,
        userId: state.recoveryUserId,
      })
    );
  };
  const apply = async (attempt: QuizV2Attempt) => {
    if (attempt.status === 'in_progress') {
      set({
        status: 'question',
        v2Attempt: attempt,
        v2LifecycleStatus: 'in_progress',
        lockedOptionId: null,
        terminalContext: null,
        error: null,
      });
      await persist(attempt, null);
      return;
    }
    const state = get();
    set({
      status: 'result',
      v2Attempt: null,
      v2LifecycleStatus:
        attempt.status === 'event_cancelled'
          ? 'event_cancelled'
          : 'pending_results',
      terminalContext: terminalContextFor(
        attempt.attemptId,
        attempt.eventId,
        attempt.eventEndsAt,
        attempt.serverNow
      ),
      lockedOptionId: null,
      error: null,
    });
    if (state.recoveryUserId) {
      await clearQuizRecoveryEnvelope(state.recoveryUserId, attempt.eventId);
    }
  };
  const applyRecoveryResponse = async (
    response: QuizActiveAttemptResponse,
    fallback: QuizV2Attempt
  ) => {
    if (
      response.availability === 'active' &&
      response.attempt &&
      isOpenAtServerTime(response)
    ) {
      await apply(response.attempt);
      return;
    }
    const expiredActive =
      response.availability === 'active' && response.attempt;
    const terminal =
      expiredActive ||
      response.availability === 'pending_results' ||
      response.availability === 'cancelled';
    if (terminal) {
      const state = get();
      set({
        status: 'result',
        v2Attempt: null,
        v2LifecycleStatus:
          response.availability === 'cancelled'
            ? 'event_cancelled'
            : 'pending_results',
        terminalContext: terminalContextFor(
          fallback.attemptId,
          fallback.eventId,
          response.eventEndsAt ?? fallback.eventEndsAt,
          response.serverNow ?? fallback.serverNow
        ),
        lockedOptionId: null,
        error: null,
      });
      if (state.recoveryUserId) {
        await clearQuizRecoveryEnvelope(state.recoveryUserId, fallback.eventId);
      }
    }
  };
  const actions: QuizV2StoreActions = {
    startEventV2: async (context: V2StartContext, starter) => {
      if (['starting', 'submitting'].includes(get().status)) return;
      const generation = getGeneration();
      const existing = await loadQuizRecoveryEnvelope(
        context.userId,
        context.eventId
      );
      const startRequestId = existing?.startRequestId ?? context.startRequestId;
      set({
        ...initialQuizV2State,
        status: 'starting',
        selectedEventId: context.eventId,
        attemptIntegrityTier: context.integrityTier,
        startRequestId,
        recoveryUserId: context.userId,
        error: null,
      });
      await saveQuizRecoveryEnvelope(
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
      try {
        const attempt = await starter(startRequestId);
        if (generation === getGeneration()) await apply(attempt);
      } catch (error) {
        if (generation === getGeneration())
          set({ status: 'ready', error: getMessage(error) });
      }
    },
    recoverEvent: async (userId, eventId, recoverer, resender) => {
      if (get().status === 'submitting') return;
      const generation = getGeneration();
      set({
        status: 'starting',
        recoveryUserId: userId,
        selectedEventId: eventId,
      });
      const envelope = await loadQuizRecoveryEnvelope(userId, eventId);
      const recovered = await recoverer();
      if (generation !== getGeneration()) return;
      if (
        recovered.availability === 'active' &&
        recovered.attempt &&
        isOpenAtServerTime(recovered)
      ) {
        set({
          startRequestId: envelope?.startRequestId ?? null,
          v2Attempt: recovered.attempt,
        });
        if (
          envelope?.pendingLockedOptionId &&
          envelope.currentQuestionId === recovered.attempt.question?.id
        ) {
          set({
            status: 'submitting',
            lockedOptionId: envelope.pendingLockedOptionId,
          });
          await apply(
            await resender(
              envelope.pendingLockedOptionId,
              envelope.currentQuestionId
            )
          );
        } else await apply(recovered.attempt);
        return;
      }
      const cancelled = recovered.availability === 'cancelled';
      const pending = recovered.availability === 'pending_results';
      const expiredActive =
        recovered.availability === 'active' && recovered.attempt;
      set({
        status: cancelled || pending || expiredActive ? 'result' : 'ready',
        v2Attempt: null,
        v2LifecycleStatus: cancelled
          ? 'event_cancelled'
          : pending || expiredActive
            ? 'pending_results'
            : 'idle',
        terminalContext:
          cancelled || pending || expiredActive
            ? recovered.attempt
              ? terminalContextFor(
                  recovered.attempt.attemptId,
                  eventId,
                  recovered.attempt.eventEndsAt,
                  recovered.attempt.serverNow
                )
              : envelope?.attemptId
                ? terminalContextFor(
                    envelope.attemptId,
                    eventId,
                    recovered.eventEndsAt,
                    recovered.serverNow
                  )
                : null
            : null,
      });
      if ((cancelled || pending || expiredActive) && envelope) {
        await clearQuizRecoveryEnvelope(userId, eventId);
      }
    },
    reconcileLifecycle: async (reconciler, nowMs = Date.now()) => {
      if (
        reconciliationInFlight ||
        get().status !== 'question' ||
        get().lockedOptionId ||
        (lastReconciledAt > 0 &&
          nowMs - lastReconciledAt < QUIZ_RECONCILIATION_INTERVAL_MS)
      )
        return;
      reconciliationInFlight = true;
      try {
        const response = await reconciler();
        lastReconciledAt = nowMs;
        const attempt = get().v2Attempt;
        if (
          response.availability === 'active' &&
          response.attempt &&
          isOpenAtServerTime(response)
        )
          await apply(response.attempt);
        else if (attempt) await applyRecoveryResponse(response, attempt);
      } finally {
        reconciliationInFlight = false;
      }
    },
    expireActiveEvent: async (reconciler) => {
      const attempt = get().v2Attempt;
      if (
        expiryInFlight ||
        !attempt ||
        !['question', 'submitting'].includes(get().status)
      )
        return;
      expiryInFlight = true;
      const generation = getGeneration();
      lifecycleEpoch += 1;
      const expiryEpoch = lifecycleEpoch;
      try {
        const response = await reconciler();
        if (generation !== getGeneration() || expiryEpoch !== lifecycleEpoch)
          return;
        await applyRecoveryResponse(response, attempt);
      } catch (error) {
        if (generation === getGeneration())
          set({ status: 'question', error: getMessage(error) });
      } finally {
        expiryInFlight = false;
      }
    },
    lockAndSubmitAnswer: async (optionId, submitter) => {
      const attempt = get().v2Attempt;
      if (
        get().status !== 'question' ||
        !attempt?.question ||
        get().lockedOptionId
      )
        return;
      const generation = getGeneration();
      const submitEpoch = lifecycleEpoch;
      set({ status: 'submitting', lockedOptionId: optionId, error: null });
      await persist(attempt, optionId);
      try {
        const next = await submitter(optionId);
        if (generation === getGeneration() && submitEpoch === lifecycleEpoch)
          await apply(next);
      } catch (error) {
        if (generation === getGeneration() && submitEpoch === lifecycleEpoch)
          set({ status: 'question', error: getMessage(error) });
      }
    },
    retryLockedAnswer: async (submitter) => {
      const optionId = get().lockedOptionId;
      if (retryInFlight || !optionId || !get().v2Attempt?.question) return;
      retryInFlight = true;
      const generation = getGeneration();
      const retryEpoch = lifecycleEpoch;
      set({ status: 'submitting', error: null });
      try {
        const next = await submitter(optionId);
        if (generation === getGeneration() && retryEpoch === lifecycleEpoch)
          await apply(next);
      } catch (error) {
        if (generation === getGeneration() && retryEpoch === lifecycleEpoch)
          set({ status: 'question', error: getMessage(error) });
      } finally {
        retryInFlight = false;
      }
    },
    setV2Result: (result) =>
      set({
        status: 'result',
        v2LifecycleStatus:
          result.availability === 'pending'
            ? 'pending_results'
            : result.availability === 'unavailable' &&
                result.reason === 'event_cancelled'
              ? 'event_cancelled'
              : 'final',
        v2Result: result,
        terminalContext: get().terminalContext,
      }),
  };
  return actions;
}
