import { useEffect, useRef } from 'react';
import { getQuizDeviceFingerprint } from '@/lib/get-quiz-device-fingerprint';
import {
  type QuizAttempt,
  type QuizIntegrityTier,
  startQuizAttempt,
} from '@/services/quiz';
import { QuizServiceError } from '@/services/quiz-types';
import { useAuthStore } from '@/stores/auth-store';
import { getQuizErrorMessage } from './QuizScreen.utils';
import { useQuizDateOfBirthGate } from './useQuizDateOfBirthGate';
import { useQuizStartGate } from './useQuizStartGate';

// Server error code raised by QuizAgeGateError (route-helpers-guards.ts) when a
// stored date of birth fails the 18+ gate. Detected client-side to reopen the
// correction gate rather than stranding the shopper.
const QUIZ_AGE_RESTRICTED_CODE = 'quiz_age_restricted';
const START_FAILED_FALLBACK = 'Quiz action failed';

type StartEvent = (
  eventId: string,
  integrityTier: QuizIntegrityTier,
  starter: () => Promise<QuizAttempt>
) => Promise<void>;

/**
 * Orchestrates the two first-play gates and the attempt start. A shopper must
 * satisfy BOTH gates before their first play: a public username (their
 * leaderboard name) and a date of birth (Super Quiz is 18+). The username gate
 * opens first; on success it hands off to the date-of-birth gate, which either
 * opens or proceeds to the actual start. Both gates fall back to the
 * authoritative server start while the customer row is still hydrating.
 *
 * If the server age gate rejects a stored DOB (an adult mistyped it), the DOB
 * gate reopens for correction — it is the only DOB editor and a rejected start
 * creates no attempt.
 */
export function useQuizStartFlow({
  integrityTier,
  startEvent,
}: {
  integrityTier: QuizIntegrityTier;
  startEvent: StartEvent;
}) {
  // Bridges the declaration cycle: handleStart reopens the DOB gate on an age
  // rejection, but dobGate is created after it. Synced via an effect so the
  // compiler-managed render stays side-effect free.
  const reopenDobForCorrectionRef = useRef<
    ((eventId: string, message: string) => void) | null
  >(null);

  const handleStart = async (eventId: string) => {
    // startEvent owns the in-flight/error state and swallows starter failures
    // into the store, so the age-gate recovery lives inside the starter (the
    // only place the thrown error is observable).
    await startEvent(eventId, integrityTier, async () => {
      // Resolve inside the starter so startEvent enters its synchronous
      // in-flight state before this best-effort native lookup can yield.
      const deviceFingerprint = await getQuizDeviceFingerprint().catch(
        () => null
      );
      // Snapshot the signed-in shopper. If the account signs out or switches
      // while this request is in flight, an age-rejection reopen would open this
      // stale event under the new session (letting the new shopper start it), so
      // skip the reopen unless the same identity is still signed in.
      const startUserId = useAuthStore.getState().user?.id ?? null;
      try {
        return await startQuizAttempt({
          deviceFingerprint,
          eventId,
          integrityTier,
        });
      } catch (error) {
        // Reopen the gate so the rejected DOB can be corrected. Re-throw so
        // startEvent still exits its in-flight state; the reopened gate (not the
        // page banner, which is suppressed while the gate is visible) shows why.
        if (
          error instanceof QuizServiceError &&
          error.code === QUIZ_AGE_RESTRICTED_CODE &&
          startUserId !== null &&
          useAuthStore.getState().user?.id === startUserId
        ) {
          reopenDobForCorrectionRef.current?.(
            eventId,
            getQuizErrorMessage(error, START_FAILED_FALLBACK)
          );
        }
        throw error;
      }
    });
  };

  const dobGate = useQuizDateOfBirthGate((eventId) => {
    void handleStart(eventId);
  });
  const usernameGate = useQuizStartGate((eventId) => {
    dobGate.requestStart(eventId);
  });

  // Keep the reopen handler reachable from handleStart, which is defined above
  // dobGate to break the declaration cycle.
  useEffect(() => {
    reopenDobForCorrectionRef.current = dobGate.reopenForCorrection;
  });

  return { dobGate, usernameGate };
}
