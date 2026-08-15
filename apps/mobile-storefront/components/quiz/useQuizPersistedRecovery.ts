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
  const [retryNonce, setRetryNonce] = useState(0);
  enabledRef.current = enabled;
  canRecoverRef.current = canRecover;

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
      return;
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
          if (!isCurrentRun()) return;
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
          if (!isCurrentRun()) return;
          if (outcome === 'retry') {
            shouldRetry = true;
            return;
          }
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
}
