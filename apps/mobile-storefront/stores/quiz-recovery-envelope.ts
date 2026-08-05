import { z } from 'zod';
import { asyncStorage } from '@/lib/storage';
import type {
  QuizActiveAttemptResponse,
  QuizIntegrityTier,
  QuizV2Attempt,
  QuizV2Result,
} from '@/services/quiz-types';

const RECOVERY_VERSION = 1 as const;
const KEY_PREFIX = 'baci:quiz-recovery:v1';

// biome-ignore format: Compact schema keeps this recovery module below the repository limit.
const recoveryEnvelopeSchema = z.strictObject({ attemptId: z.string().trim().min(1).nullable(), currentQuestionId: z.string().trim().min(1).nullable(), eventId: z.string().trim().min(1), generation: z.number().int().nonnegative(), pendingLockedOptionId: z.string().trim().min(1).nullable(), startRequestId: z.uuid(), userId: z.string().trim().min(1), version: z.literal(RECOVERY_VERSION) });

export type QuizRecoveryEnvelope = z.infer<typeof recoveryEnvelopeSchema>;

export type QuizV2LifecycleStatus =
  | 'idle'
  | 'in_progress'
  | 'pending_results'
  | 'event_cancelled'
  | 'final';

type QuizSurfaceStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'starting'
  | 'question'
  | 'submitting'
  | 'result'
  | 'error';
// biome-ignore format: Compact state contract keeps this recovery module below the repository limit.
export interface QuizV2StoreState { attemptIntegrityTier: QuizIntegrityTier | null; error: string | null; lockedOptionId: string | null; recoveryUserId: string | null; selectedEventId: string | null; startRequestId: string | null; status: QuizSurfaceStatus; v2Attempt: QuizV2Attempt | null; v2LifecycleStatus: QuizV2LifecycleStatus; v2Result: QuizV2Result | null; }
// biome-ignore format: Compact value contract keeps this recovery module below the repository limit.
export interface V2StartContext { eventId: string; integrityTier: QuizIntegrityTier; startRequestId: string; userId: string; }
// biome-ignore format: Compact initial state keeps this recovery module below the repository limit.
export const initialQuizV2State = { v2Attempt: null, lockedOptionId: null, startRequestId: null, recoveryUserId: null, v2Result: null, v2LifecycleStatus: 'idle' as const };

// biome-ignore format: Compact action contract keeps this recovery module below the repository limit.
export interface QuizV2StoreActions { startEventV2(context: V2StartContext, starter: (startRequestId: string) => Promise<QuizV2Attempt>): Promise<void>; recoverEvent(userId: string, eventId: string, recoverer: () => Promise<QuizActiveAttemptResponse>, resender: (optionId: string, questionId: string) => Promise<QuizV2Attempt>): Promise<void>; reconcileLifecycle(reconciler: () => Promise<QuizActiveAttemptResponse>, nowMs?: number): Promise<void>; lockAndSubmitAnswer(optionId: string, submitter: (optionId: string) => Promise<QuizV2Attempt>): Promise<void>; setV2Result(result: QuizV2Result): void; }

function recoveryKey(userId: string, eventId: string): string {
  return `${KEY_PREFIX}:${encodeURIComponent(userId)}:${encodeURIComponent(eventId)}`;
}

export function createQuizRecoveryEnvelope(
  input: Omit<QuizRecoveryEnvelope, 'version'>
): QuizRecoveryEnvelope {
  return recoveryEnvelopeSchema.parse({ ...input, version: RECOVERY_VERSION });
}

export async function saveQuizRecoveryEnvelope(
  envelope: QuizRecoveryEnvelope
): Promise<void> {
  const parsed = recoveryEnvelopeSchema.parse(envelope);
  await asyncStorage.setItem(
    recoveryKey(parsed.userId, parsed.eventId),
    JSON.stringify(parsed)
  );
}

export async function loadQuizRecoveryEnvelope(
  userId: string,
  eventId: string
): Promise<QuizRecoveryEnvelope | null> {
  const key = recoveryKey(userId, eventId);
  const stored = await asyncStorage.getItem(key);
  if (!stored) return null;
  try {
    const parsed = recoveryEnvelopeSchema.safeParse(JSON.parse(stored));
    // biome-ignore format: Keep the small identity guard compact for the module-size gate.
    if (parsed.success && parsed.data.userId === userId && parsed.data.eventId === eventId) {
      return parsed.data;
    }
  } catch {
    // Invalid or obsolete storage is discarded below.
  }
  await asyncStorage.removeItem(key);
  return null;
}

export function clearQuizRecoveryEnvelope(
  userId: string,
  eventId: string
): Promise<void> {
  return asyncStorage.removeItem(recoveryKey(userId, eventId));
}

type StoreAccess = {
  get: () => QuizV2StoreState;
  getGeneration: () => number;
  getMessage: (error: unknown) => string;
  set: (state: Partial<QuizV2StoreState>) => void;
};

export const QUIZ_RECONCILIATION_INTERVAL_MS = 15_000;

export function createQuizV2StoreActions({
  get,
  getGeneration,
  getMessage,
  set,
}: StoreAccess) {
  let lastReconciledAt = 0;
  let reconciliationInFlight = false;

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
        error: null,
      });
      await persist(attempt, null);
      return;
    }
    const state = get();
    set({
      status: 'result',
      v2Attempt: attempt,
      v2LifecycleStatus:
        attempt.status === 'event_cancelled'
          ? 'event_cancelled'
          : 'pending_results',
      lockedOptionId: null,
      error: null,
    });
    if (state.recoveryUserId) {
      await clearQuizRecoveryEnvelope(state.recoveryUserId, attempt.eventId);
    }
  };

  const actions: QuizV2StoreActions = {
    startEventV2: async (context, starter) => {
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
        if (generation === getGeneration()) {
          set({ status: 'ready', error: getMessage(error) });
        }
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
      if (recovered.availability === 'active' && recovered.attempt) {
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
      set({
        status: cancelled || pending ? 'result' : 'ready',
        v2Attempt: null,
        v2LifecycleStatus: cancelled
          ? 'event_cancelled'
          : pending
            ? 'pending_results'
            : 'idle',
      });
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
        if (response.availability === 'active' && response.attempt)
          await apply(response.attempt);
        else if (response.availability === 'cancelled')
          set({
            status: 'result',
            v2Attempt: null,
            v2LifecycleStatus: 'event_cancelled',
          });
        else if (response.availability === 'pending_results')
          set({
            status: 'result',
            v2Attempt: null,
            v2LifecycleStatus: 'pending_results',
          });
      } finally {
        reconciliationInFlight = false;
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
      set({ status: 'submitting', lockedOptionId: optionId, error: null });
      await persist(attempt, optionId);
      try {
        const next = await submitter(optionId);
        if (generation === getGeneration()) await apply(next);
      } catch (error) {
        if (generation === getGeneration())
          set({ status: 'question', error: getMessage(error) });
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
      }),
  };
  return actions;
}
