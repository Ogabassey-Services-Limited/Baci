import { useEffect, useRef } from 'react';
import { getQuizDeviceFingerprint } from '@/lib/get-quiz-device-fingerprint';
import { recoverActiveQuizAttempt } from '@/services/quiz-attempt-recovery';
import { submitQuizAnswerV2 } from '@/services/quiz-attempts';
import {
  loadQuizRecoveryEnvelopes,
  type QuizV2StoreActions,
} from '@/stores/quiz-recovery-envelope';

interface UseQuizPersistedRecoveryInput {
  enabled: boolean;
  recoverEvent: QuizV2StoreActions['recoverEvent'];
  userId: string | null;
}

export function useQuizPersistedRecovery({
  enabled,
  recoverEvent,
  userId,
}: UseQuizPersistedRecoveryInput) {
  const attemptedUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) {
      attemptedUserId.current = null;
      return;
    }
    if (!enabled || attemptedUserId.current === userId) return;
    attemptedUserId.current = userId;

    let active = true;
    const recover = async () => {
      const envelopes = await loadQuizRecoveryEnvelopes(userId);
      const envelope = envelopes[0];
      if (!active || !envelope) return;
      const deviceFingerprint = await getQuizDeviceFingerprint().catch(
        () => null
      );
      if (!active) return;
      await recoverEvent(
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
            throw new Error('Retained quiz attempt is missing its attempt ID.');
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
    };

    void recover().catch(() => undefined);
    return () => {
      active = false;
    };
  }, [enabled, recoverEvent, userId]);
}
