import { useRef, useState } from 'react';
import type { QuizEventResponse } from '@/schemas/quiz';

type UpdateCustomer = (data: {
  date_of_birth: string;
}) => Promise<{ success: boolean; error?: string }>;

type UseQuizAgeGateArgs = {
  /** Starts the attempt; resolves to the error message on failure, else null. */
  runStart: (event: QuizEventResponse) => Promise<string | null>;
  updateCustomer: UpdateCustomer;
  /** Clears any page-level start error so the gate owns the single alert. */
  clearStartError: () => void;
};

/**
 * Orchestrates the Super Quiz 18+ date-of-birth gate: it defers a start until a
 * DOB is captured, then saves it and starts the attempt.
 *
 * Concurrency safety (each successful start burns one of the player's limited
 * attempts, so this must never double-fire):
 * - `saveInFlightRef` is a synchronous guard so a double-tap on Continue cannot
 *   fire two saves before React disables the button.
 * - `tokenRef` is a monotonic cancellation token; cancelling (or re-opening for
 *   another event) invalidates any in-flight save so its continuation cannot
 *   start the quiz after the shopper dismissed the gate.
 * - On a start failure it keeps the gate open with the error, so a mistyped or
 *   under-18 DOB can be corrected instead of stranding the shopper (there is no
 *   other DOB editor once `customer.date_of_birth` is set).
 */
export function useQuizAgeGate({
  runStart,
  updateCustomer,
  clearStartError,
}: UseQuizAgeGateArgs) {
  const [event, setEvent] = useState<QuizEventResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveInFlightRef = useRef(false);
  const tokenRef = useRef(0);

  // Opening or cancelling starts a new gate generation (bumps the token), so
  // release the in-flight guard too — otherwise a resubmit for the new gate is
  // dropped by a stale save that has not resolved yet. `initialError` seeds the
  // alert when we reopen after the server rejected a stored DOB (18+).
  const open = (next: QuizEventResponse, initialError: string | null = null) => {
    tokenRef.current += 1;
    saveInFlightRef.current = false;
    setError(initialError);
    setEvent(next);
  };

  const cancel = () => {
    tokenRef.current += 1;
    saveInFlightRef.current = false;
    setEvent(null);
  };

  const submit = async (dateOfBirth: string) => {
    if (!event || saveInFlightRef.current) return;
    saveInFlightRef.current = true;
    const token = tokenRef.current;
    setSubmitting(true);
    setError(null);
    try {
      const saved = await updateCustomer({ date_of_birth: dateOfBirth });
      if (token !== tokenRef.current) return;
      if (!saved.success) {
        setError(saved.error ?? 'Could not save your date of birth.');
        return;
      }
      const startError = await runStart(event);
      if (token !== tokenRef.current) return;
      if (startError) {
        clearStartError();
        setError(startError);
        return;
      }
      setEvent(null);
    } finally {
      // Only the current generation may clear the shared flags: a stale save
      // that resolves after a cancel/reopen must not reset the guard or the
      // submitting state a newer submission has already set.
      if (token === tokenRef.current) {
        saveInFlightRef.current = false;
        setSubmitting(false);
      }
    }
  };

  return { event, submitting, error, open, cancel, submit };
}
