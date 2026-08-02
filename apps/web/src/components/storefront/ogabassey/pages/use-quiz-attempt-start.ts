import { type Dispatch, type SetStateAction, useEffect, useRef } from 'react';
import type {
  QuizAttemptResponse,
  QuizEventResponse,
  QuizResultResponse,
} from '@/schemas/quiz';
import { getQuizErrorMessage } from './get-quiz-error-message';
import { type QuizStatus, startQuizAttempt } from './quiz-page-data';

type UseQuizAttemptStartArgs = {
  /** Current signed-in shopper (auth user id); binds a start to this identity. */
  currentUserId: string | null;
  setError: Dispatch<SetStateAction<string | null>>;
  setStatus: Dispatch<SetStateAction<QuizStatus>>;
  setAttempt: Dispatch<SetStateAction<QuizAttemptResponse | null>>;
  setPlayedEventId: Dispatch<SetStateAction<string | null>>;
  setResult: Dispatch<SetStateAction<QuizResultResponse | null>>;
  setSelectedAnswer: Dispatch<SetStateAction<string | null>>;
};

/**
 * Starts a quiz attempt and commits it into the page's state, guarding two
 * concurrency hazards (each start burns one of the player's limited attempts):
 * - `startInFlightRef` swallows a fast physical double-tap: async `status`
 *   updates on the next render, so two taps can fire before the button disables.
 * - `currentUserIdRef` binds the start to the initiating shopper. Auth changes
 *   don't cancel an in-flight request, so if the account switches during the
 *   start we must NOT commit the attempt/question into page state — the new
 *   session would otherwise be shown the previous shopper's quiz. On a mismatch
 *   we drop the commit and return to the event list.
 *
 * Returns the shopper-facing error on failure (so the age gate can stay open
 * with the message rather than stranding the shopper), or null on success.
 */
export function useQuizAttemptStart({
  currentUserId,
  setError,
  setStatus,
  setAttempt,
  setPlayedEventId,
  setResult,
  setSelectedAnswer,
}: UseQuizAttemptStartArgs) {
  const startInFlightRef = useRef(false);
  // Mirrors the latest committed user id so the async body can read it after its
  // await (a render closure would see the start-time value and miss a switch).
  const currentUserIdRef = useRef(currentUserId);
  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  return async function runStart(
    event: QuizEventResponse
  ): Promise<string | null> {
    if (startInFlightRef.current) return null;
    startInFlightRef.current = true;
    const startUserId = currentUserIdRef.current;
    setError(null);
    setStatus('starting');
    try {
      // Pass the snapshot as expectedUserId so the server refuses (409) if the
      // cookie session switched while the POST was deferred — the post-await
      // check below only suppresses the UI, it can't undo a server-side start.
      const nextAttempt = await startQuizAttempt(
        event.id,
        startUserId ?? undefined
      );
      if (currentUserIdRef.current !== startUserId) {
        // Account switched during the start: discard the page-level commit and
        // return to the event list rather than rendering the stale attempt.
        setStatus('ready');
        return null;
      }
      setAttempt(nextAttempt);
      setPlayedEventId(event.id);
      setResult(null);
      setSelectedAnswer(null);
      setStatus('question');
      return null;
    } catch (error) {
      if (currentUserIdRef.current !== startUserId) {
        // Account switched: the failure belongs to the previous shopper. Don't
        // surface its error (or, for an age-gate rejection, reopen the DOB modal)
        // under the new session — just return to the event list.
        setStatus('ready');
        return null;
      }
      const message = getQuizErrorMessage(error);
      setError(message);
      setStatus('ready');
      return message;
    } finally {
      startInFlightRef.current = false;
    }
  };
}
