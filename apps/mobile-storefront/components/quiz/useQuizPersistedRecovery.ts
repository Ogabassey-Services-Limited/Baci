import { useEffect, useRef, useState } from 'react';
import { getQuizDeviceFingerprint } from '@/lib/get-quiz-device-fingerprint';
import { recoverActiveQuizAttempt } from '@/services/quiz-attempt-recovery';
import { submitQuizAnswerV2 } from '@/services/quiz-attempts';
import {
  loadQuizRecoveryEnvelopes,
  type QuizV2StoreActions,
} from '@/stores/quiz-recovery-envelope';

interface UseQuizPersistedRecoveryInput {
  canRecover?: () => boolean;
  enabled: boolean;
  recoverEvent: QuizV2StoreActions['recoverEvent'];
  userId: string | null;
}

function isRetainedTerminalEnvelope({
  attemptId,
  currentQuestionId,
  pendingLockedOptionId,
}: {
  attemptId: string | null;
  currentQuestionId: string | null;
  pendingLockedOptionId: string | null;
}) {
  return Boolean(attemptId && !currentQuestionId && !pendingLockedOptionId);
}

export function useQuizPersistedRecovery({
  canRecover = () => true,
  enabled,
  recoverEvent,
  userId,
}: UseQuizPersistedRecoveryInput) {
  const attemptedUserId = useRef<string | null>(null);
  const recoveringUserId = useRef<string | null>(null);
  const retryScheduled = useRef(false);
  const mounted = useRef(false);
  const enabledRef = useRef(enabled);
  const previousEnabled = useRef(enabled);
  const canRecoverRef = useRef(canRecover);
  const handledTerminalEventIds = useRef<Set<string>>(new Set());
  const handledTerminalUserId = useRef<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  enabledRef.current = enabled;
  canRecoverRef.current = canRecover;

  const retryRecovery = () => {
    if (!userId) return;
    attemptedUserId.current = null;
    retryScheduled.current = false;
    setRetryNonce((nonce) => nonce + 1);
  };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const becameEnabled = enabled && !previousEnabled.current;
    previousEnabled.current = enabled;
    if (
      becameEnabled &&
      userId &&
      !retryScheduled.current &&
      !recoveringUserId.current &&
      attemptedUserId.current !== userId
    )
      setRetryNonce((nonce) => nonce + 1);
  }, [enabled, userId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: retryNonce intentionally retriggers the bounded recovery retry; the ownership guard keeps a recovery call alive across its own status transition.
  useEffect(() => {
    if (!userId) {
      attemptedUserId.current = null;
      recoveringUserId.current = null;
      retryScheduled.current = false;
      handledTerminalEventIds.current.clear();
      handledTerminalUserId.current = null;
      return;
    }
    if (handledTerminalUserId.current !== userId) {
      handledTerminalEventIds.current.clear();
      handledTerminalUserId.current = userId;
    }
    if (!enabled || attemptedUserId.current === userId) return;
    if (recoveringUserId.current === userId) return;
    recoveringUserId.current = userId;
    let cancelled = false;
    let recoveryOwnsStatus = false;
    const isCurrentRun = () =>
      !cancelled &&
      mounted.current &&
      (recoveryOwnsStatus || canRecoverRef.current());

    const recover = async () => {
      let shouldRetry = false;
      try {
        const envelopes = await loadQuizRecoveryEnvelopes(userId);
        if (!isCurrentRun()) return;
        if (!envelopes.length) {
          attemptedUserId.current = userId;
          retryScheduled.current = false;
          return;
        }
        const deviceFingerprint = await getQuizDeviceFingerprint().catch(
          () => null
        );
        if (!isCurrentRun()) return;
        for (const envelope of envelopes) {
          if (handledTerminalEventIds.current.has(envelope.eventId)) continue;
          const isTerminalEnvelope = isRetainedTerminalEnvelope(envelope);
          if (!isCurrentRun() && !isTerminalEnvelope) return;
          recoveryOwnsStatus = true;
          const outcome = await recoverEvent(
            userId,
            envelope.eventId,
            () =>
              recoverActiveQuizAttempt({
                deviceFingerprint,
                eventId: envelope.eventId,
                expectedUserId: userId,
              }),
            (optionId, questionId) => {
              if (!envelope.attemptId) {
                throw new Error(
                  'Retained quiz attempt is missing its attempt ID.'
                );
              }
              return submitQuizAnswerV2({
                answer: optionId,
                attemptId: envelope.attemptId,
                clientAnsweredAt: new Date().toISOString(),
                expectedUserId: userId,
                questionId,
              });
            }
          );
          recoveryOwnsStatus = false;
          if (outcome === 'retry') {
            shouldRetry = true;
            return;
          }
          if (
            outcome === 'recovered_terminal' ||
            (outcome === 'recovered' && isTerminalEnvelope)
          ) {
            // A result screen owns one terminal attempt at a time. Keep the
            // next retained prize for the next recovery pass so it cannot
            // overwrite the single terminal context currently being polled.
            handledTerminalEventIds.current.add(envelope.eventId);
            return;
          }
          if (!isCurrentRun() && !isTerminalEnvelope) return;
          if (outcome === 'recovered') {
            attemptedUserId.current = userId;
            retryScheduled.current = false;
            return;
          }
        }
        attemptedUserId.current = userId;
        retryScheduled.current = false;
      } catch {
        shouldRetry = true;
      } finally {
        recoveryOwnsStatus = false;
        if (recoveringUserId.current === userId) {
          recoveringUserId.current = null;
        }
        if (
          shouldRetry &&
          enabledRef.current &&
          mounted.current &&
          !cancelled &&
          !retryScheduled.current
        ) {
          retryScheduled.current = true;
          setRetryNonce((nonce) => nonce + 1);
        }
      }
    };

    void recover();
    return () => {
      cancelled = true;
      if (recoveringUserId.current === userId) {
        recoveringUserId.current = null;
      }
    };
  }, [recoverEvent, retryNonce, userId]);

  return { retryRecovery };
}
