// biome-ignore format: Compact import keeps this coordinator within the module budget.
import type { QuizV2Attempt } from '@/services/quiz-types';
import {
  initialQuizV2State,
  loadQuizRecoveryEnvelope,
  type QuizV2StoreActions,
  type V2StartContext,
} from './quiz-recovery-envelope';
import { createQuizV2ExpiryAction } from './quiz-v2-expiry-action';
import { createQuizV2RecoveryResponseApplier } from './quiz-v2-recovery-actions';
import {
  clearRecoveredQuizAttempt,
  clearTerminalRecovery,
  createQuizAttemptPersistence,
  saveQuizStartRequest,
} from './quiz-v2-recovery-storage';
import { createQuizTerminalContext } from './quiz-v2-terminal-context';
import { isQuizOpenAtServerTime } from './quiz-v2-server-clock';
import { resultLifecycle } from './quiz-v2-result-lifecycle';
import type { QuizV2StoreAccess } from './quiz-v2-store-access';
export const QUIZ_RECONCILIATION_INTERVAL_MS = 15_000;
export function createQuizV2StoreActions({
  get,
  getGeneration,
  getMessage,
  set,
}: QuizV2StoreAccess): QuizV2StoreActions {
  let lastReconciledAt = 0;
  let reconciliationInFlight = false;
  let retryInFlight = false;
  let lifecycleEpoch = 0;
  // biome-ignore format: Compact dependency bundle keeps this coordinator within the module budget.
  const access = { get, getGeneration, getMessage, set };
  const persist = createQuizAttemptPersistence(access);
  const apply = async (attempt: QuizV2Attempt) => {
    if (attempt.status === 'in_progress') {
      set({
        status: 'question',
        v2Attempt: attempt,
        v2LifecycleStatus: 'in_progress',
        lockedOptionId: null,
        terminalContext: null,
        expiryRetryable: false,
        error: null,
      });
      await persist(attempt, null);
      return;
    }
    set({
      status: 'result',
      v2Attempt: null,
      v2LifecycleStatus:
        attempt.status === 'event_cancelled'
          ? 'event_cancelled'
          : 'pending_results',
      terminalContext: createQuizTerminalContext(
        attempt.attemptId,
        attempt.eventId,
        attempt.eventEndsAt,
        attempt.serverNow
      ),
      lockedOptionId: null,
      expiryRetryable: false,
      error: null,
    });
    if (attempt.status === 'event_cancelled') {
      await clearRecoveredQuizAttempt(access, attempt.eventId);
    }
  };
  const applyRecoveryResponse = createQuizV2RecoveryResponseApplier({
    access,
    apply,
  });
  const expireActiveEvent = createQuizV2ExpiryAction({
    access,
    applyRecoveryResponse,
    getLifecycleEpoch: () => lifecycleEpoch,
    nextLifecycleEpoch: () => {
      lifecycleEpoch += 1;
      return lifecycleEpoch;
    },
  });
  return {
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
      await saveQuizStartRequest(context, generation, startRequestId);
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
      try {
        const envelope = await loadQuizRecoveryEnvelope(userId, eventId);
        const recovered = await recoverer();
        if (generation !== getGeneration()) return;
        if (
          recovered.availability === 'active' &&
          recovered.attempt &&
          isQuizOpenAtServerTime(recovered)
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
                ? createQuizTerminalContext(
                    recovered.attempt.attemptId,
                    eventId,
                    recovered.attempt.eventEndsAt,
                    recovered.attempt.serverNow
                  )
                : envelope?.attemptId
                  ? createQuizTerminalContext(
                      envelope.attemptId,
                      eventId,
                      recovered.eventEndsAt,
                      recovered.serverNow
                    )
                  : null
              : null,
        });
        await clearTerminalRecovery(
          access,
          eventId,
          Boolean(cancelled && envelope)
        );
      } catch (error) {
        if (generation === getGeneration()) {
          set({ status: 'ready', error: getMessage(error) });
        }
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
          isQuizOpenAtServerTime(response)
        )
          await apply(response.attempt);
        else if (attempt) await applyRecoveryResponse(response, attempt);
      } finally {
        reconciliationInFlight = false;
      }
    },
    expireActiveEvent,
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
    setV2Result: (result) => {
      const terminalContext = get().terminalContext;
      set({
        status: 'result',
        v2LifecycleStatus: resultLifecycle(result),
        v2Result: result,
        terminalContext,
      });
      if (result.availability !== 'pending' && terminalContext?.eventId) {
        void clearRecoveredQuizAttempt(access, terminalContext.eventId).catch(
          () => undefined
        );
      }
    },
  };
}
